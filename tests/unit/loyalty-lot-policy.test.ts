import { describe, it, expect } from 'vitest';
import { assertPoints, creditExpiry, orderLots } from '@/lib/commerce/loyalty-policy';
import { prepareLoyaltyAdjustment } from '@/lib/commerce/loyalty-adjust-draft';
import { AdjustLoyaltyBalanceSchema } from '@/services/loyalty.service';

describe('WF-09 policy and uncertain adjustment retry', () => {
  it('consumes earliest expiry and uses stable date/id ties, placing no-expiry last', () => {
    const createdAt = new Date('2026-01-01'); const expiry = new Date('2026-10-06');
    const items = [{ id: 'z', createdAt, expiresAt: null }, { id: 'b', createdAt, expiresAt: expiry },
      { id: 'a', createdAt, expiresAt: expiry }, { id: 'old', createdAt, expiresAt: new Date('2026-10-05') }];
    expect(orderLots(items).map(lot => lot.id)).toEqual(['old', 'a', 'b', 'z']);
    expect(items[0].id).toBe('z');
  });
  it('older credits with the same expiry win before the id tie-break', () => {
    const expiresAt = new Date('2026-11-01');
    expect(orderLots([{ id: 'a', createdAt: new Date('2026-02-01'), expiresAt }, { id: 'z', createdAt: new Date('2026-01-01'), expiresAt }])[0].id).toBe('z');
  });
  it('missing term explicitly means no expiry, and configured compensation is relative to return time', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    expect(creditExpiry(null, now)).toBeNull(); expect(creditExpiry(3, now)).toEqual(new Date('2026-10-08T00:00:00Z'));
  });
  it('refuses invalid terms and overflow without manufacturing a deadline', () => {
    for (const days of [0, -1, 1.5, Infinity, 999999999999]) expect(() => creditExpiry(days, new Date())).toThrow();
  });
  it('bounds integer quantities at the PostgreSQL boundary', () => {
    expect(() => assertPoints(2147483647)).not.toThrow();
    for (const points of [NaN, Infinity, -1, 0.5, 2147483648]) expect(() => assertPoints(points)).toThrow();
    expect(() => assertPoints(-10, true)).not.toThrow();
  });
  it('requires an identity for administrative adjustments and rejects fields outside the contract', () => {
    const data = { lojaID: 'shop', userID: 'buyer', adminUserId: 'admin', points: 100, description: 'Crédito auditado' };
    expect(AdjustLoyaltyBalanceSchema.safeParse(data).success).toBe(false);
    expect(AdjustLoyaltyBalanceSchema.safeParse({ ...data, commandId: 'adjust-1', expiresAt: null }).success).toBe(true);
    expect(AdjustLoyaltyBalanceSchema.safeParse({ ...data, commandId: 'adjust-1', balance: 999 }).success).toBe(false);
  });
  it('reuses the exact command for response loss and a new id only for a changed intent', () => {
    const data = { userID: ' buyer ', points: 100, description: ' Crédito auditado ' };
    const first = prepareLoyaltyAdjustment(data, null, () => 'first');
    const retry = prepareLoyaltyAdjustment({ ...data, userID: 'buyer', description: 'Crédito auditado' }, first.pending, () => 'unused');
    expect(retry.body).toEqual(first.body);
    expect(prepareLoyaltyAdjustment({ ...data, points: 101 }, first.pending, () => 'second').body.commandId).toBe('second');
    expect(prepareLoyaltyAdjustment(data, null, () => 'after-confirmed-success').body.commandId).toBe('after-confirmed-success');
  });
});
