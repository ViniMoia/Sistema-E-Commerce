import prisma from '@/lib/prisma';
import { z } from 'zod';
import type { FinancialPlan } from '@/lib/commerce/contracts';
import type { PaymentGateway, PaymentCustomerData, CreditCardData } from '@/types/payment-gateway.types';
import { moneyCents } from './installment.service';
import { applyPaymentEvidence } from './payment-evidence.service';
import { CommerceLocks } from '@/lib/commerce/locks';
import { paymentEvidenceTransactionOptions } from './payment-execution-policy';
const baseResult = z.object({ paymentId: z.string().min(1).max(128), value: z.number().finite().positive(),
  status: z.enum(['PENDING', 'CONFIRMED', 'RECEIVED', 'AWAITING_RISK_ANALYSIS']), invoiceUrl: z.string().url().optional() });
const cardMetadata = z.object({ creditCardBrand: z.string().regex(/^[A-Z_ -]{1,32}$/).optional(), creditCardLast4: z.string().regex(/^\d{4}$/).optional() });
const chargeSchema = baseResult.pick({ paymentId: true, value: true, status: true }).extend({ ordinal: z.number().int().positive() });
export async function executePaymentAttempt(input: { orderId: string; orderNumber: number; lojaID: string; attemptId: string;
  plan: FinancialPlan; gateway: PaymentGateway; customer: PaymentCustomerData; creditCard?: CreditCardData }) {
  const { plan } = input;
  try {
    const capabilities = await input.gateway.capabilities(input.lojaID);
    if (!capabilities.configured || !capabilities.methods.includes(plan.method)) throw new Error('PAYMENT_METHOD_UNAVAILABLE_AFTER_ACCEPT');
    // Durable SUBMITTING was committed together with the order. A crash cannot
    // make a possibly submitted attempt look like permission to create again.
    const common = { orderId: input.orderId, orderNumber: input.orderNumber, value: Number(plan.financialTotal), customer: input.customer };
    const result = plan.method === 'CREDIT_CARD' ? await input.gateway.createCreditCardCharge({ ...common, creditCard: input.creditCard!, installmentCount: plan.installments.length }) :
      plan.method === 'BOLETO' ? await input.gateway.createBoletoCharge(common) : await input.gateway.createPixCharge(common);
    const verified = baseResult.parse(result);
    if (moneyCents(verified.value) !== moneyCents(plan.financialTotal)) throw new Error('PAYMENT_CONTRACT_MISMATCH');
    const pix = 'pixPayload' in result ? z.object({ pixPayload: z.string().min(1), pixQrCodeBase64: z.string().min(1) }).parse(result) : null;
    const boleto = 'bankSlipUrl' in result ? z.object({ bankSlipUrl: z.string().url(), digitableLine: z.string().min(1), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
      const date = new Date(value + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
    }) }).parse(result) : null;
    if ((plan.method === 'PIX' && !pix) || (plan.method === 'BOLETO' && !boleto)) throw new Error('PAYMENT_ARTIFACTS_MISSING');
    const card = plan.method === 'CREDIT_CARD' && 'charges' in result ? result : null;
    const metadata = card ? cardMetadata.parse(card) : null;
    const charges = card ? z.array(chargeSchema).parse(card.charges) : [{ paymentId: verified.paymentId, ordinal: 1, value: verified.value, status: verified.status }];
    if (charges.length !== plan.installments.length || new Set(charges.map(c => c.paymentId)).size !== charges.length ||
      charges.some((c, index) => !c.paymentId || c.ordinal !== index + 1 || moneyCents(c.value) !== moneyCents(plan.installments[index]))) throw new Error('PAYMENT_CONTRACT_MISMATCH');
    if (plan.method === 'CREDIT_CARD' && (!card || (plan.installments.length > 1 && !card.contractId))) throw new Error('PAYMENT_CONTRACT_INCOMPLETE');
    if (card && (charges[0].paymentId !== verified.paymentId || charges[0].status !== verified.status)) throw new Error('PAYMENT_CONTRACT_MISMATCH');
    const approved = (card ? !!card.approvedForEntireContract : plan.method !== 'CREDIT_CARD') && charges.every(c => ['CONFIRMED', 'RECEIVED'].includes(c.status));
    await prisma.$transaction(async tx => {
      await new CommerceLocks(tx).acquire('order', [input.orderId]);
      const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: input.attemptId } });
      if (attempt.orderId !== input.orderId) throw new Error('PAYMENT_ATTEMPT_CONFLICT');
      const expiration = plan.method === 'PIX' && 'expirationDate' in result && typeof result.expirationDate === 'string' && /Z$|[+-]\d{2}:\d{2}$/.test(result.expirationDate)
        ? new Date(result.expirationDate).toISOString() : undefined;
      const evidence = await applyPaymentEvidence(tx, attempt.id, { complete: true, contractApproved: plan.method === 'CREDIT_CARD' ? approved : undefined, charges: charges.map(c => ({ ...c,
        externalReference: attempt.externalReference, method: plan.method, contractId: card?.contractId,
        dueAt: boleto ? new Date(new Date(boleto.dueDate + 'T00:00:00-03:00').getTime() + 86400000).toISOString() : undefined,
        instructions: pix ? { ...pix, ...(expiration ? { expiresAt: expiration } : {}) } : boleto ? { bankSlipUrl: boleto.bankSlipUrl, digitableLine: boleto.digitableLine } : undefined })) });
      if (evidence.review) throw new Error('PAYMENT_EVIDENCE_REVIEW');
      // applyPaymentEvidence owns the monotonic status projection. A webhook
      // may have settled the charge while this creation response was in flight.
      // Persist only supplementary artifacts, never the older response status.
      await tx.order.update({ where: { id: input.orderId }, data: { asaasPaymentId: verified.paymentId,
        asaasInvoiceUrl: verified.invoiceUrl, ...(metadata ? metadata : {}),
        ...(boleto ? { asaasBankSlipUrl: boleto.bankSlipUrl, asaasDigitableLine: boleto.digitableLine } : {}) } });
    }, paymentEvidenceTransactionOptions);
    return { kind: 'ISSUED' as const, result };
  } catch {
    // Includes receipt lookup/validation and local persistence failures AFTER
    // a provider may have accepted the charge. No blind compensation/retry.
    await prisma.paymentAttempt.updateMany({ where: { id: input.attemptId, status: 'SUBMITTING' },
      data: { status: 'UNKNOWN', failureCode: 'PAYMENT_RESULT_UNRESOLVED', reconcileAfter: new Date(), version: { increment: 1 } } });
    // Approval proof already committed must survive a subsequent failure of
    // local fulfillment. Queue application of that proof without resubmission.
    await prisma.paymentAttempt.updateMany({ where: { id: input.attemptId, status: 'APPROVED' },
      data: { failureCode: 'PAYMENT_APPROVAL_PENDING_APPLICATION', reconcileAfter: new Date(), version: { increment: 1 } } });
    return { kind: 'PROCESSING' as const, result: null };
  }
}
