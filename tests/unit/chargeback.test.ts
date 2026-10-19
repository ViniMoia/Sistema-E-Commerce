import { describe, it, expect } from 'vitest';
import { classifyChargeback, savedChargeback } from '@/services/payment/chargeback';

describe('chargeback evidence boundaries', () => {
  it('does not interpret an ordinary charge as a dispute', () => {
    expect(classifyChargeback(undefined, 'CONFIRMED', 'CREDIT_CARD', null)).toBeNull();
  });
  it.each([{}, { status: 'reversed' }, { status: 'UNKNOWN' }, { status: 'REVERSED', reason: 'contains personal free text' }])('holds invalid/unknown evidence %j', raw => {
    expect(classifyChargeback(raw, 'RECEIVED', 'CREDIT_CARD', null)?.review).toBe(true);
  });
  it('does not apply card chargeback semantics to PIX or use a win to undo a persisted refund', () => {
    expect(classifyChargeback({ status: 'REVERSED' }, 'RECEIVED', 'PIX', null)?.review).toBe(true);
    expect(classifyChargeback({ status: 'REVERSED' }, 'RECEIVED', 'CREDIT_CARD', null, 'REFUNDED')?.review).toBe(true);
  });
  it('keeps only bounded selected fields and requires the financial terminal state', () => {
    const active = classifyChargeback({ status: 'DISPUTE_LOST', secret: 'omit' }, 'CONFIRMED', 'CREDIT_CARD', null)!;
    expect(active).toMatchObject({ outcome: 'AWAITING_FINANCIAL_RESULT', review: true });
    expect(active).not.toHaveProperty('secret');
    expect(classifyChargeback({ status: 'DISPUTE_LOST' }, 'REFUNDED', 'CREDIT_CARD', active)).toMatchObject({ outcome: 'REFUNDED', review: false });
    expect(classifyChargeback(null, 'REFUNDED', 'CREDIT_CARD', active)).toMatchObject({ outcome: 'REFUNDED', review: false });
    expect(savedChargeback({ chargeback: active })).toEqual(active);
    expect(savedChargeback({ chargeback: { outcome: 'REVERSED' } })).toBeNull();
  });
});
