import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';
import prisma from '@/lib/prisma';

/**
 * Provedor de Frete J&T Express
 * Utiliza a matriz oficial de tarifas do Centro de Distribuição em Ananindeua/PA (CEP: 67140-615)
 * integrada às tabelas PostgreSQL `JtExpressGeocom` (58 faixas) e `JtExpressRate` (5.181 tarifas).
 */
export class JtExpressProvider implements IFreightProvider {
  public readonly id = 'JT_EXPRESS';
  public readonly name = 'J&T Express';

  /**
   * Verifica se a loja possui a tabela da J&T Express disponível.
   */
  public async isAvailableForStore(lojaID: string, storeSettings?: any): Promise<boolean> {
    try {
      const count = await prisma.jtExpressRate.count();
      return count > 0;
    } catch (err) {
      console.error('[JT_EXPRESS_AVAILABILITY_ERROR]', err);
      return false;
    }
  }

  /**
   * Calcula a cotação de frete com base no CEP de destino, cubagem e peso dos itens.
   */
  public async calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]> {
    const destCep = request.destinationCep.replace(/\D/g, '');
    if (!destCep || destCep.length !== 8) {
      return [];
    }

    try {
      // 1. Identificar o GEOCOM correspondente à faixa de CEP de destino
      const geocom = await prisma.jtExpressGeocom.findFirst({
        where: {
          cepStart: { lte: destCep },
          cepEnd: { gte: destCep },
        },
      });

      if (!geocom) {
        return [];
      }

      // 2. Cálculo de Cubagem e Peso Tributável
      // Fórmula volumétrica padrão expressa: (C x L x A) / 6000
      const physicalWeightKg = Math.max(0.1, request.packages.weightInGrams / 1000);
      const volumeCm3 =
        (request.packages.lengthCm || 16) *
        (request.packages.widthCm || 11) *
        (request.packages.heightCm || 4);
      const cubageWeightKg = volumeCm3 / 6000;
      const taxableWeightKg = Math.max(physicalWeightKg, cubageWeightKg);

      // 3. Consulta da Tarifa na tabela JtExpressRate por GEOCOM e faixa de peso
      let rate = await prisma.jtExpressRate.findFirst({
        where: {
          geocom: geocom.geocomCode,
          weightMin: { lte: taxableWeightKg },
          weightMax: { gte: taxableWeightKg },
        },
      });

      // Se o peso exceder o teto tabelado (ex: > 30kg), busca a faixa máxima e aplica kg adicional
      if (!rate) {
        rate = await prisma.jtExpressRate.findFirst({
          where: {
            geocom: geocom.geocomCode,
          },
          orderBy: {
            weightMax: 'desc',
          },
        });
      }

      if (!rate) {
        return [];
      }

      let basePrice = Number(rate.basePrice);
      const maxWeight = Number(rate.weightMax);

      if (taxableWeightKg > maxWeight && rate.additionalKgPrice) {
        const excessKg = Math.ceil(taxableWeightKg - maxWeight);
        basePrice += excessKg * Number(rate.additionalKgPrice);
      }

      // 4. Encargos de Proteção de Carga: Ad-Valorem (Seguro) e GRIS (Risco)
      // Conforme especificação oficial: Ad-Valorem 0,2% e GRIS 0,4% (ou 0,3% e 1,0% em áreas de risco)
      const cartValue = Math.max(0, request.cartTotal || 0);
      const adValoremRate = geocom.isRiskZone ? 0.003 : 0.002;
      const grisRate = geocom.isRiskZone ? 0.01 : 0.004;
      const insuranceFee = cartValue * (adValoremRate + grisRate);

      const totalPrice = Math.round((basePrice + insuranceFee) * 100) / 100;
      const additionalDays = request.storeSettings?.additionalDays || 0;
      const deliveryDays = Math.max(1, (geocom.deliveryDays || 3) + additionalDays);

      return [
        {
          providerId: 'JT_EXPRESS',
          serviceCode: 'JT_STANDARD',
          serviceName: 'J&T Express Standard',
          carrier: 'J&T Express',
          price: totalPrice,
          originalPrice: totalPrice,
          deliveryTimeInDays: deliveryDays,
          description: `Entrega expressa porta a porta (${geocom.state})`,
          isRecommended: true,
        },
      ];
    } catch (error) {
      console.error('[JT_EXPRESS_CALCULATION_ERROR]', error);
      return [];
    }
  }
}
