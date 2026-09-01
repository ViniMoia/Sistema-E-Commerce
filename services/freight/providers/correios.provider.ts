import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';

export class CorreiosProvider implements IFreightProvider {
  public readonly id = 'CORREIOS';
  public readonly name = 'Correios (SEDEX e PAC)';

  public async isAvailableForStore(lojaID: string, storeSettings?: any): Promise<boolean> {
    // Habilitado se a loja configurou o CEP de origem e ativou os Correios
    if (storeSettings?.enableCorreios !== undefined) {
      return Boolean(storeSettings.enableCorreios);
    }
    return true;
  }

  public async calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]> {
    const originCep = request.originCep.replace(/\D/g, '');
    const destCep = request.destinationCep.replace(/\D/g, '');

    if (!originCep || !destCep || destCep.length !== 8 || originCep.length !== 8) {
      return [];
    }

    const { weightInGrams, lengthCm, widthCm, heightCm } = request.packages;
    const weightKg = Math.max(0.1, weightInGrams / 1000);
    const additionalDays = request.storeSettings?.additionalDays || 0;

    const options: FreightOption[] = [];

    try {
      // Chamada HTTP para API de cálculo com Timeout de 3.5 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Endpoint da API de Preço e Prazo dos Correios
      const url = new URL('https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx');
      url.searchParams.append('nCdEmpresa', request.storeSettings?.correiosContractCode || '');
      url.searchParams.append('sDsSenha', request.storeSettings?.correiosPassword || '');
      url.searchParams.append('nCdServico', '04014,04510'); // 04014: SEDEX, 04510: PAC
      url.searchParams.append('sCepOrigem', originCep);
      url.searchParams.append('sCepDestino', destCep);
      url.searchParams.append('nVlPeso', weightKg.toFixed(2));
      url.searchParams.append('nCdFormato', '1'); // 1 = Caixa/Pacote
      url.searchParams.append('nVlComprimento', lengthCm.toString());
      url.searchParams.append('nVlAltura', heightCm.toString());
      url.searchParams.append('nVlLargura', widthCm.toString());
      url.searchParams.append('nVlDiametro', '0');
      url.searchParams.append('sCdMaoPropria', 'N');
      url.searchParams.append('nVlValorDeclarado', '0');
      url.searchParams.append('sCdAvisoRecebimento', 'N');
      url.searchParams.append('StrRetorno', 'xml');

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'E-Commerce-Freight-Service/1.0' },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        // Parse dos serviços retornados no XML dos Correios
        const parsedServices = this.parseCorreiosXml(text);

        for (const s of parsedServices) {
          if (s.codigo === '04014' || s.codigo === '4014') {
            options.push({
              providerId: 'CORREIOS',
              serviceCode: '04014',
              serviceName: 'SEDEX',
              carrier: 'Correios',
              price: s.valor,
              deliveryTimeInDays: s.prazoEntrega + additionalDays,
              description: `Entrega expressa via SEDEX (${s.prazoEntrega + additionalDays} dias úteis)`,
            });
          } else if (s.codigo === '04510' || s.codigo === '4510') {
            options.push({
              providerId: 'CORREIOS',
              serviceCode: '04510',
              serviceName: 'PAC',
              carrier: 'Correios',
              price: s.valor,
              deliveryTimeInDays: s.prazoEntrega + additionalDays,
              description: `Entrega econômica via PAC (${s.prazoEntrega + additionalDays} dias úteis)`,
              isRecommended: true,
            });
          }
        }
      }
    } catch (err: any) {
      // Log seguro sem derrubar o fluxo em caso de timeout / offline dos Correios
      console.warn(`[CORREIOS_PROVIDER_WARNING] Falha na consulta direta aos Correios: ${err.message}. Aplicando tabela de contingência.`);
    }

    // Se a API dos Correios falhar temporariamente, aplica fallback tarifário estimado
    if (options.length === 0) {
      const fallbackOptions = this.calculateContingencyTariffs(originCep, destCep, weightKg, additionalDays);
      options.push(...fallbackOptions);
    }

    return options;
  }

  /**
   * Parser simples e seguro para o XML retornado pelos Correios
   */
  private parseCorreiosXml(xml: string): Array<{ codigo: string; valor: number; prazoEntrega: number; erro: string }> {
    const results: Array<{ codigo: string; valor: number; prazoEntrega: number; erro: string }> = [];
    const servicos = xml.match(/<cServico>([\s\S]*?)<\/cServico>/gi) || [];

    for (const servicoXml of servicos) {
      const codigoMatch = servicoXml.match(/<Codigo>(.*?)<\/Codigo>/i);
      const valorMatch = servicoXml.match(/<Valor>(.*?)<\/Valor>/i);
      const prazoMatch = servicoXml.match(/<PrazoEntrega>(.*?)<\/PrazoEntrega>/i);
      const erroMatch = servicoXml.match(/<Erro>(.*?)<\/Erro>/i);

      const codigo = codigoMatch ? codigoMatch[1].trim() : '';
      const rawValor = valorMatch ? valorMatch[1].replace(',', '.') : '0';
      const valor = parseFloat(rawValor) || 0;
      const prazoEntrega = prazoMatch ? parseInt(prazoMatch[1], 10) || 5 : 5;
      const erro = erroMatch ? erroMatch[1].trim() : '0';

      // Erro "0" ou "010" (prazo com restrição de entrega) são considerados válidos
      if (valor > 0 && (erro === '0' || erro === '010' || erro === '')) {
        results.push({ codigo, valor, prazoEntrega, erro });
      }
    }

    return results;
  }

  /**
   * Tabela tarifária de contingência caso os servidores dos Correios estejam instáveis.
   * Evita perda de vendas durante quedas pontuais da API governamental.
   */
  private calculateContingencyTariffs(originCep: string, destCep: string, weightKg: number, additionalDays: number): FreightOption[] {
    const isSameRegion = originCep.substring(0, 2) === destCep.substring(0, 2);
    const isSameState = originCep.substring(0, 1) === destCep.substring(0, 1);

    let basePac = isSameRegion ? 18.50 : isSameState ? 24.90 : 32.50;
    let baseSedex = isSameRegion ? 26.00 : isSameState ? 38.50 : 54.00;

    // Adicional por peso acima de 1kg
    const extraWeight = Math.max(0, weightKg - 1);
    basePac += extraWeight * 4.5;
    baseSedex += extraWeight * 8.0;

    const pacDays = (isSameRegion ? 3 : isSameState ? 5 : 8) + additionalDays;
    const sedexDays = (isSameRegion ? 1 : isSameState ? 2 : 4) + additionalDays;

    return [
      {
        providerId: 'CORREIOS',
        serviceCode: '04510',
        serviceName: 'PAC (Estimado)',
        carrier: 'Correios',
        price: Number(basePac.toFixed(2)),
        deliveryTimeInDays: pacDays,
        description: `Envio econômico (${pacDays} dias úteis)`,
        isRecommended: true,
      },
      {
        providerId: 'CORREIOS',
        serviceCode: '04014',
        serviceName: 'SEDEX (Estimado)',
        carrier: 'Correios',
        price: Number(baseSedex.toFixed(2)),
        deliveryTimeInDays: sedexDays,
        description: `Envio expresso (${sedexDays} dias úteis)`,
      },
    ];
  }
}
