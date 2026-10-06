import { Prisma } from '@prisma/client';
import { vi } from 'vitest';

/** Domain tests may isolate shipping behind an already authorized snapshot.
 * Actual signatures, ownership, geography, locks and rollback are exercised in
 * freight-authority.test.ts against a real, guarded PostgreSQL instance. */
export function freightAcceptanceMock(amount: number) {
  return {
    acceptFreightQuote: vi.fn(async (_tx: unknown, input: { token?: string; ownerKey?: string }) => {
      if (!input.token || !input.ownerKey) throw new Error('FREIGHT_QUOTE_REQUIRED');
      return { id: 'authorized-fixture-quote', amount: new Prisma.Decimal(amount), provider: 'LOCAL_TABLE',
        serviceName: 'Entrega Local', estimatedDays: 1, snapshot: { schemaVersion: 2 } };
    }),
    authorizeFreeFreight: vi.fn(async (_tx: unknown, _lojaID: string, deliveryType: string) => ({ id: null, amount: new Prisma.Decimal(0),
      provider: deliveryType === 'PICKUP' ? 'STORE_PICKUP' : 'NONE', serviceName: 'Retirada na Loja', estimatedDays: 0,
      snapshot: { schemaVersion: 2 } })),
  };
}
