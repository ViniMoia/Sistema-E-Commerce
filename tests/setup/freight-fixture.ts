import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore } from './fixture-scope';
import { FreightOrchestratorService } from '@/services/freight/orchestrator.service';
import { CustomTableProvider } from '@/services/freight/providers/custom-table.provider';
import type { FreightItems } from '@/lib/freight/authority';

export async function fixtureFreightQuote(input: { lojaID: string; ownerKey: string; items: FreightItems; cep?: string }) {
  await verifyTestDatabase(); await createFixtureStore(input.lojaID); // refuses adoption of an unowned store
  const rule = await prisma.freightRule.findFirst({ where: { lojaID: input.lojaID, cityName: 'São Paulo' } });
  const geography = { state: 'SP', municipalityCode: '3550308' };
  if (!rule) await prisma.freightRule.create({ data: { lojaID: input.lojaID, cityName: 'São Paulo', value: 15, ...geography } });
  else if (!rule.state || !rule.municipalityCode) await prisma.freightRule.update({ where: { id: rule.id }, data: geography });
  const service = new FreightOrchestratorService([new CustomTableProvider()], async cep => ({ cep, city: 'São Paulo', ...geography }));
  const result = await service.calculate({ ...input, destinationCep: input.cep ?? '01001000', deliveryType: 'DELIVERY' });
  return result.options[0].freightQuoteToken!;
}
