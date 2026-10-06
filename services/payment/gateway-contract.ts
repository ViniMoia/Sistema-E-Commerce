import { z } from 'zod';
import { moneyCents } from './installment.service';
import { PaymentGatewayError } from '@/types/payment-gateway.types';
const paymentSchema = z.object({ id: z.string().min(1).max(128), billingType: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']),
  value: z.number().finite().positive(), status: z.enum(['PENDING', 'CONFIRMED', 'RECEIVED', 'AWAITING_RISK_ANALYSIS']),
  externalReference: z.string(), installment: z.string().optional(), installmentNumber: z.number().int().positive().optional() });
export function verifyRemotePayment(raw: unknown, expected: { orderId: string; method: string; value: number }) {
  const result = paymentSchema.safeParse(raw);
  if (!result.success || result.data.externalReference !== expected.orderId || result.data.billingType !== expected.method ||
    moneyCents(result.data.value) !== moneyCents(expected.value)) throw new PaymentGatewayError('PAYMENT_CONTRACT_MISMATCH', undefined, 'PAYMENT_CONTRACT_MISMATCH');
  return result.data;
}
export function verifyInstallmentContract(raw: unknown[], expected: { orderId: string; contractId: string; value: number; count: number }) {
  if (raw.length !== expected.count) throw new PaymentGatewayError('PAYMENT_CONTRACT_INCOMPLETE');
  const total = moneyCents(expected.value), ordinary = total / BigInt(expected.count);
  const payments = raw.map(row => paymentSchema.parse(row)).sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0));
  if (new Set(payments.map(p => p.id)).size !== expected.count) throw new PaymentGatewayError('PAYMENT_CONTRACT_MISMATCH');
  payments.forEach((payment, index) => {
    const amount = index === expected.count - 1 ? total - ordinary * BigInt(expected.count - 1) : ordinary;
    if (payment.installment !== expected.contractId || payment.installmentNumber !== index + 1 || payment.externalReference !== expected.orderId ||
      payment.billingType !== 'CREDIT_CARD' || moneyCents(payment.value) !== amount) throw new PaymentGatewayError('PAYMENT_CONTRACT_MISMATCH');
  });
  return payments.map(payment => ({ paymentId: payment.id, ordinal: payment.installmentNumber!, value: payment.value, status: payment.status }));
}
