import { Prisma, type Loja } from '@prisma/client';
import { financialPlanSchema } from '@/lib/commerce/contracts';
import { freezeEarnPolicy } from '@/lib/commerce/loyalty-earn';
import { installmentPlan, moneyCents } from './installment.service';
import type { PaymentConfig } from '@/lib/config/payment.config';
import type { PaymentMethod } from '@/types/payment-gateway.types';
export function buildFinancialPlan(input: { store: Loja; method: PaymentMethod; subtotal: Prisma.Decimal; discount: Prisma.Decimal;
  freight: Prisma.Decimal; eligible: boolean; count: number; config: PaymentConfig; maximumInstallments: number;
  acceptedFinancialTotal?: number; installmentValue?: number; requireConsent?: boolean }) {
  const net = input.subtotal.minus(input.discount);
  if (net.isNegative()) throw new Error('PAYMENT_DISCOUNT_INVALID');
  const commercial = net.plus(input.freight); const count = input.count;
  if (count > input.maximumInstallments || (input.method !== 'CREDIT_CARD' && count !== 1)) throw new Error('PAYMENT_PLAN_INVALID');
  const term = commercial.isZero() && input.method === 'WHATSAPP_PIX'
    ? { financialTotal: '0.00', financingCharge: '0.00', installments: ['0.00'], installmentValue: 0 }
    : installmentPlan(commercial.toFixed(2), count, input.config);
  if (input.method !== 'WHATSAPP_PIX' && new Prisma.Decimal(term.financialTotal).lt(input.config.asaasMinValue)) throw new Error('PAYMENT_BELOW_MINIMUM');
  if ((input.requireConsent !== false && input.method === 'CREDIT_CARD' && input.acceptedFinancialTotal === undefined) ||
      (input.acceptedFinancialTotal !== undefined && moneyCents(input.acceptedFinancialTotal) !== moneyCents(term.financialTotal)) ||
      (input.installmentValue !== undefined && moneyCents(input.installmentValue) !== moneyCents(term.installments[0]))) throw new Error('PAYMENT_RECONFIRM_REQUIRED');
  const earn = freezeEarnPolicy(input.store, net, input.eligible);
  const plan = financialPlanSchema.parse({ schemaVersion: 1, policyVersion: input.store.configurationVersion, method: input.method,
    merchandiseSubtotal: input.subtotal.toFixed(2), loyaltyDiscount: input.discount.toFixed(2), shippingCost: input.freight.toFixed(2),
    commercialTotal: commercial.toFixed(2), financialTotal: term.financialTotal, financingCharge: term.financingCharge,
    installments: term.installments, loyaltyEarnBase: net.toFixed(2), pointsEarned: earn.points });
  return { plan, earn, term, rule: { version: 'price-rational-half-up-last-residual-v1', ...input.config } };
}
