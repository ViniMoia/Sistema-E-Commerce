import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeMunicipality } from '@/lib/freight/destination';

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
    // Busca regras da loja
      if (!request.destination) return [];
      const rules = await prisma.freightRule.findMany({
        where: { lojaID: request.lojaID, state: request.destination.state, municipalityCode: request.destination.municipalityCode },
      });

      if (!rules || rules.length === 0) {
        return [];
      }

      // Se tiver regras de frete fixo cadastradas
      const options: FreightOption[] = [];
      for (const rule of rules) {
        if (normalizeMunicipality(rule.cityName) !== normalizeMunicipality(request.destination.city)) continue;
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

  }
}
