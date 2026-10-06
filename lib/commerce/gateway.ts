import type { FinancialPlan, PaymentState } from './contracts';

// UNKNOWN is a first-class outcome. An HTTP timeout or empty search is never
// mapped to DECLINED or interpreted as permission to submit a second charge.
export type GatewayOutcome =
  | { kind: 'KNOWN'; state: Extract<PaymentState, 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'REFUNDED'>;
      contractId?: string; charges: Array<{ providerPaymentId: string; ordinal: number; amount: string }> }
  | { kind: 'UNKNOWN'; reasonCode: 'TIMEOUT' | 'TRANSPORT_FAILURE' | 'UNRESOLVED_REFERENCE' }
  | { kind: 'UNAVAILABLE'; reasonCode: 'MISSING_CONFIGURATION' | 'UNSUPPORTED_METHOD' };

export interface PaymentGateway {
  capabilities(): Promise<{ configured: boolean; methods: FinancialPlan['method'][]; maximumInstallments: number }>;
  submit(input: { externalReference: string; plan: FinancialPlan; buyerId: string;
    ephemeralInstrument?: { token: string } }): Promise<GatewayOutcome>;
  reconcile(input: { externalReference: string; contractId?: string; paymentIds: string[] }): Promise<GatewayOutcome>;
  cancel(input: { commandKey: string; contractId?: string; paymentIds: string[] }): Promise<GatewayOutcome>;
  refund(input: { commandKey: string; paymentId: string; amount: string }): Promise<GatewayOutcome>;
}

// Adapters and a supervised implementation are introduced in WF-14. Leasing
// is persisted; acknowledgement belongs to the same transaction as its effects.
export interface DurableWorkExecutor {
  drain(input: { workerId: string; limit: number; now: Date }): Promise<{
    completed: number; rescheduled: number; deadLettered: number;
  }>;
}
