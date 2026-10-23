import { paymentAccountScope } from '@/lib/commerce/payment-account';

export interface PaymentAttemptTarget {
  attemptId: string;
  orderId: string;
  lojaID: string;
  providerAccount: string;
}

export function validatePaymentAttemptTarget(target: PaymentAttemptTarget) {
  if (!target || [target.attemptId, target.orderId, target.lojaID, target.providerAccount]
    .some(value => typeof value !== 'string' || !value.trim())) throw new Error('PAYMENT_ATTEMPT_TARGET_REQUIRED');
  if (target.providerAccount !== paymentAccountScope()) throw new Error('PAYMENT_ACCOUNT_SCOPE_MISMATCH');
}
