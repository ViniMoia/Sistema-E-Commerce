import { Prisma, type Loja } from '@prisma/client';
import { vi } from 'vitest';
/** Explicit store policy for older domain unit suites. Does not authorize a
 * remote gateway; payment authority is tested separately without this helper. */
export function completePaymentStore(store: Loja): Loja {
  return Object.assign(store, { configurationVersion: 0, loyaltyEnabled: false,
    loyaltyEarnRate: new Prisma.Decimal('0.5'), loyaltyPointValue: new Prisma.Decimal('0.05'),
    loyaltyPointsExpiryDays: 365, enableManualPix: true, enablePix: false, enableCreditCard: false,
    enableBoleto: false, whatsappNumber: '11999999999', pixKey: 'fixture@example.invalid', ...store });
}
export function paymentAttemptFixture() {
  let current: Record<string, unknown>;
  return {
    create: vi.fn(async ({ data }) => (current = { id: 'fixture-attempt', ...data })),
    findUniqueOrThrow: vi.fn(async () => current),
    update: vi.fn(async ({ data }) => ({ ...current, ...data })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
}
