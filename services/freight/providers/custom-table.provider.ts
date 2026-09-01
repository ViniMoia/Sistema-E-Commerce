import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
      // Busca regras da loja
      const rules = await prisma.freightRule.findMany({
        where: { lojaID: request.lojaID },
      });

      if (!rules || rules.length === 0) {
        return [];
      }

      // Se tiver regras de frete fixo cadastradas
      const options: FreightOption[] = [];
      for (const rule of rules) {
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
      console.error('[CUSTOM_TABLE_PROVIDER_ERROR]', error);
      return [];
    }
  }
}
