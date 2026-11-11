import { FreightOption, FreightQuoteRequest, IFreightProvider } from '@/types/freight';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeMunicipality } from '@/lib/freight/destination';
import {
  findBelemAnanindeuaRate,
  isLocalMetropolitanArea,
} from '@/lib/freight/belem-ananindeua-neighborhoods';
import { isHeavyOrLargeProduct } from '@/lib/freight/shipping-mode';

export class CustomTableProvider implements IFreightProvider {
  public readonly id = 'LOCAL_TABLE';
  public readonly name = 'Tabela de Frete Local';

  public async isAvailableForStore(lojaID: string): Promise<boolean> {
    // Disponível nativamente para entregas locais (Belém/Ananindeua) ou via regras customizadas
    return true;
  }

  public async calculateQuotes(request: FreightQuoteRequest): Promise<FreightOption[]> {
    if (!request.destination) return [];

    const options: FreightOption[] = [];
    const dest = request.destination;
    const additionalDays = request.storeSettings?.additionalDays || 0;

    // 1. Tabela Oficial de Bairros (Belém, Ananindeua e Marituba)
    if (dest.state === 'PA' && isLocalMetropolitanArea(dest.city, dest.municipalityCode)) {
      const rate = findBelemAnanindeuaRate(dest.city, dest.municipalityCode, dest.neighborhood);

      if (rate) {
        // Verifica se o carrinho contém itens pesados ou volumosos
        const totalWeightGrams = request.packages?.weightInGrams ?? 0;
        const items = request.items || [];
        const hasHeavyItem =
          totalWeightGrams >= 15000 ||
          items.some(item => isHeavyOrLargeProduct({
            name: item.name || '',
            weightInGrams: item.weightInGrams,
            lengthCm: item.lengthCm,
            widthCm: item.widthCm,
            heightCm: item.heightCm,
          }));

        if (hasHeavyItem) {
          options.push({
            providerId: 'LOCAL_TABLE',
            serviceCode: `LOCAL_BAIRRO_${rate.id}`,
            serviceName: `Entrega Própria da Loja - ${rate.name}`,
            carrier: 'Veículo Continental (Próprio)',
            price: rate.price,
            deliveryTimeInDays: 4 + additionalDays,
            description: `Entrega em veículo próprio para produtos pesados/maiores (prazo de até 4 dias úteis para ${rate.name}).`,
          });
        } else {
          options.push({
            providerId: 'LOCAL_TABLE',
            serviceCode: `LOCAL_BAIRRO_${rate.id}`,
            serviceName: `Entregador Local - ${rate.name}`,
            carrier: 'Entregador Local',
            price: rate.price,
            deliveryTimeInDays: 1 + additionalDays,
            description: `Entrega expressa por entregador local para o bairro ${rate.name} (prazo de 1 dia útil).`,
          });
        }

        return options;
      }
    }

    // 2. Fallback para regras manuais cadastradas no banco (FreightRule)
    const rules = await prisma.freightRule.findMany({
      where: {
        lojaID: request.lojaID,
        state: dest.state,
        municipalityCode: dest.municipalityCode,
      },
    });

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        if (normalizeMunicipality(rule.cityName) !== normalizeMunicipality(dest.city)) continue;
        const val = (rule.value as Prisma.Decimal).toNumber();
        options.push({
          providerId: 'LOCAL_TABLE',
          serviceCode: `LOCAL_${rule.id}`,
          serviceName: `Entrega Local (${rule.cityName})`,
          carrier: 'Entrega Própria',
          price: val,
          deliveryTimeInDays: 1 + additionalDays,
          description: `Entrega expressa para a região de ${rule.cityName}`,
        });
      }
    }

    return options;
  }
}
