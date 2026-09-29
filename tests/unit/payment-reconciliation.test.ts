import { describe, expect, it } from 'vitest'

import {
  classifyGatewayPayments,
  computeReconciliationBackoffMs,
} from '@/services/payment-reconciliation.service'

describe('payment reconciliation state machine', () => {
  it('classifies an empty lookup as NOT_FOUND without authorizing a new charge', () => {
    expect(classifyGatewayPayments([])).toEqual({ kind: 'NOT_FOUND' })
  })

  it('routes duplicate references to manual review', () => {
    expect(classifyGatewayPayments([
      { paymentId: 'pay_1', status: 'PENDING', externalReference: 'ref_1' },
      { paymentId: 'pay_2', status: 'CONFIRMED', externalReference: 'ref_1' },
    ])).toEqual({ kind: 'DUPLICATE', paymentIds: ['pay_1', 'pay_2'] })
  })

  it.each([
    ['CONFIRMED', 'CONFIRMED'],
    ['RECEIVED', 'CONFIRMED'],
    ['RECEIVED_IN_CASH', 'CONFIRMED'],
    ['REFUNDED', 'REFUNDED'],
    ['REFUND_REQUESTED', 'REFUNDED'],
    ['PENDING', 'PENDING'],
    ['AWAITING_RISK_ANALYSIS', 'PENDING'],
    ['OVERDUE', 'UNPAID_TERMINAL'],
    ['DELETED', 'UNPAID_TERMINAL'],
  ])('classifies gateway status %s as %s', (status, kind) => {
    expect(classifyGatewayPayments([
      { paymentId: 'pay_1', status, externalReference: 'ref_1' },
    ])).toMatchObject({ kind })
  })

  it('uses deterministic bounded exponential backoff', () => {
    expect(computeReconciliationBackoffMs(1, 1_000, 8_000)).toBe(1_000)
    expect(computeReconciliationBackoffMs(2, 1_000, 8_000)).toBe(2_000)
    expect(computeReconciliationBackoffMs(8, 1_000, 8_000)).toBe(8_000)
  })
})
