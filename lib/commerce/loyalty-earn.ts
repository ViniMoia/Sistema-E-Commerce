import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { assertPoints } from './loyalty-policy';
export const earnSnapshotSchema = z.object({ schemaVersion: z.literal(1), policy: z.literal('net-merchandise-floor-v1'),
  configurationVersion: z.number().int().nonnegative(), enabled: z.boolean(), eligible: z.boolean(),
  base: z.string().regex(/^\d+\.\d{2}$/), rate: z.string().regex(/^\d+\.\d{2}$/),
  pointValue: z.string().regex(/^\d+\.\d{4}$/), expiryDays: z.number().int().positive().nullable(), points: z.number().int().nonnegative(),
}).strict();
export function exactEarnPoints(base: Prisma.Decimal.Value, rate: Prisma.Decimal.Value): number {
  const amount = new Prisma.Decimal(base); const multiplier = new Prisma.Decimal(rate);
  if (!amount.isFinite() || !multiplier.isFinite() || amount.isNegative() || multiplier.isNegative()) throw new Error('LOYALTY_POLICY_INVALID');
  const points = amount.mul(multiplier).floor().toNumber(); assertPoints(points); return points;
}
export function freezeEarnPolicy(store: { configurationVersion: number; loyaltyEnabled: boolean; loyaltyEarnRate: Prisma.Decimal;
  loyaltyPointValue: Prisma.Decimal; loyaltyPointsExpiryDays: number | null }, base: Prisma.Decimal, eligible: boolean) {
  return earnSnapshotSchema.parse({ schemaVersion: 1, policy: 'net-merchandise-floor-v1', configurationVersion: store.configurationVersion,
    enabled: store.loyaltyEnabled, eligible, base: base.toFixed(2), rate: store.loyaltyEarnRate.toFixed(2),
    pointValue: store.loyaltyPointValue.toFixed(4), expiryDays: store.loyaltyPointsExpiryDays,
    points: store.loyaltyEnabled && eligible ? exactEarnPoints(base, store.loyaltyEarnRate) : 0 });
}
