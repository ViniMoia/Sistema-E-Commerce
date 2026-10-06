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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      // Chamada HTTP para API de cálculo com Timeout de 3.5 segundos

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
      url.searchParams.append('nVlValorDeclarado', request.cartTotal.toFixed(2));
      url.searchParams.append('sCdAvisoRecebimento', 'N');
      url.searchParams.append('StrRetorno', 'xml');

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'E-Commerce-Freight-Service/1.0' },
      });

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
    } catch {
      throw new Error('CORREIOS_UNAVAILABLE');
    } finally { clearTimeout(timeoutId); }

    // An unavailable provider does not authorize an invented shipping price.
    if (options.length === 0) {
      throw new Error('CORREIOS_OPTIONS_UNAVAILABLE');
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

}
