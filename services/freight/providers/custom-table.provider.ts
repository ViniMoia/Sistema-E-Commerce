import { logger } from '@/lib/logger'
import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeBrazilianCity, resolveBrazilianCep } from '@/lib/cep';

export class CustomTableProvider implements IFreightProvider {
  public readonly id = 'LOCAL_TABLE';
  public readonly name = 'Tabela de Frete Local';

  public async isAvailableForStore(lojaID: string): Promise<boolean> {
    const count = await prisma.freightRule.count({
      where: { lojaID },
    });
    return count > 0;
  }

  public async calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]> {
    try {
      // A cidade vem de uma resolução servidor-servidor do CEP. O campo de cidade
      // digitado no navegador nunca seleciona a regra financeira.
      const destination = await resolveBrazilianCep(request.destinationCep);
      const normalizedDestinationCity = normalizeBrazilianCity(destination.city);
      const rules = await prisma.freightRule.findMany({
        where: { lojaID: request.lojaID },
      });
      const matchingRules = rules.filter(
        (rule) => normalizeBrazilianCity(rule.cityName) === normalizedDestinationCity
      );

      if (matchingRules.length === 0) {
        return [];
      }

      // Se tiver regras de frete fixo cadastradas
      const options: FreightOption[] = [];
      for (const rule of matchingRules) {
        const val = (rule.value as Prisma.Decimal).toNumber();
        options.push({
          providerId: 'LOCAL_TABLE',
          serviceCode: `LOCAL_${rule.id}`,
          serviceName: `Entrega Local (${rule.cityName})`,
          carrier: 'Entrega Própria',
          price: val,
          deliveryTimeInDays: 1 + (request.storeSettings?.additionalDays || 0),
          description: `Entrega expressa para a região de ${rule.cityName}`,
        });
      }

      return options;
    } catch (error) {
      logger.error('[CUSTOM_TABLE_PROVIDER_ERROR]', error);
      return [];
    }
  }
}
