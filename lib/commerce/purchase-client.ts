import { z } from 'zod';
const nullableText = z.string().nullable().optional();
export const purchaseClientSchema = z.object({
  id: z.string().min(1), checkoutIntentID: z.string().min(1), sourceCartID: nullableText, sourceCartVersion: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(['PENDING','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED']), version: z.number().int().nonnegative(),
  paymentState: z.enum(['MANUAL','ISSUED','PROCESSING','APPROVED','DECLINED','CANCELLED','REVIEW']),
  financialState: z.enum(['NOT_STARTED','SUBMITTING','UNKNOWN','PENDING','APPROVED','DECLINED','CANCEL_PENDING','CANCELLED','REFUND_PENDING','REFUNDED']),
  allowedActions: z.array(z.enum(['PAY_PIX','PAY_BOLETO','CONTACT_MANUAL'])),
  serverTime: z.string().datetime({ offset: true }), paymentExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  paymentMethod: z.enum(['PIX','WHATSAPP_PIX','BOLETO','CREDIT_CARD']), orderNumber: z.number().int(),
  customer: z.object({ name: z.string(), phone: z.string() }),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int().positive(), price: z.number().finite().nonnegative(), color: z.string().optional(), size: z.string().optional() })),
  deliveryType: z.string(), address: z.object({ street: z.string(), number: z.string(), city: z.string(), state: z.string() }).optional(),
  shippingProvider: nullableText, shippingServiceName: nullableText,
  total: z.number().finite().nonnegative(), financialTotal: z.number().finite().nonnegative(), freightValue: z.number().nullable(),
  pixKey: nullableText, pixPayload: nullableText, pixQrCode: nullableText, whatsappNumber: nullableText,
  asaasBankSlipUrl: z.string().url().refine(v => v.startsWith('https://')).nullable().optional(), asaasDigitableLine: nullableText,
  asaasDueDate: nullableText, asaasBarCode: nullableText, creditCardBrand: nullableText, creditCardLast4: nullableText,
  installments: z.number().int().positive().nullable().optional(), installmentValue: z.number().nullable().optional(),
});
export type PurchaseClient = z.infer<typeof purchaseClientSchema>;
export function purchaseView(order: PurchaseClient, elapsed = 0) {
  const expires = order.paymentExpiresAt ? new Date(order.paymentExpiresAt).getTime() : Infinity;
  const expired = expires <= new Date(order.serverTime).getTime() + Math.max(0, elapsed);
  const none = { canPayPix: false, canPayBoleto: false, canContact: false };
  if (order.financialState === 'REFUND_PENDING') return { ...none, kind: 'refund_pending', title: 'Estorno em andamento', description: 'A devolução do pagamento ainda precisa ser confirmada. Não refaça o pagamento.' };
  if (order.financialState === 'REFUNDED') return { ...none, kind: 'refunded', title: 'Estorno confirmado', description: order.paymentState === 'REVIEW' ? 'O pagamento foi estornado. O pedido ainda requer conferência, incluindo eventual devolução física.' : 'A devolução integral foi registrada. Não há pagamento a realizar.' };
  if (order.financialState === 'CANCEL_PENDING') return { ...none, kind: 'cancel_pending', title: 'Cancelamento em andamento', description: 'Aguardamos a confirmação financeira do cancelamento. Não pague esta cobrança.' };
  if (order.paymentState === 'REVIEW') return { ...none, kind: 'review', title: 'Compra requer revisão', description: 'A loja precisa conferir esta compra. Não refaça o pagamento enquanto ela estiver em revisão.' };
  if (order.status === 'CANCELLED' || order.paymentState === 'CANCELLED') return { ...none, kind: 'cancelled', title: 'Compra cancelada', description: 'Não há uma nova cobrança autorizada por esta tela.' };
  if (order.paymentState === 'DECLINED') return { ...none, kind: 'declined', title: 'Pagamento recusado', description: 'Este pagamento foi recusado. Confira seus pedidos antes de iniciar outra compra.' };
  if (order.paymentState === 'APPROVED' && order.financialState === 'APPROVED') return { ...none, kind: 'approved', title: order.status === 'DELIVERED' ? 'Pedido entregue' : order.status === 'SHIPPED' ? 'Pedido enviado' : 'Pagamento confirmado', description: 'Pagamento confirmado para o pedido #' + order.orderNumber + '.' };
  if (expired && ['NOT_STARTED','PENDING'].includes(order.financialState)) return { ...none, kind: 'expired', title: 'Prazo de pagamento encerrado', description: 'As instruções anteriores expiraram. Aguarde a conciliação; não efetue um pagamento com elas.' };
  if (order.paymentState === 'PROCESSING') return { ...none, kind: 'processing', title: order.financialState === 'UNKNOWN' || order.financialState === 'SUBMITTING' ? 'Pagamento em verificação' : 'Pagamento em análise', description: 'Aguardamos a confirmação financeira. Não refaça o pagamento.' };
  const pending = order.status === 'PENDING';
  const canPayPix = pending && order.paymentState === 'ISSUED' && order.paymentMethod === 'PIX' && !!order.pixPayload && !!order.pixQrCode && order.allowedActions.includes('PAY_PIX');
  const canPayBoleto = pending && order.paymentState === 'ISSUED' && order.paymentMethod === 'BOLETO' && !!order.asaasBankSlipUrl && !!order.asaasDigitableLine && !!order.asaasDueDate && order.allowedActions.includes('PAY_BOLETO');
  const canContact = pending && order.paymentState === 'MANUAL' && order.paymentMethod === 'WHATSAPP_PIX' && !!order.pixKey && !!order.whatsappNumber && order.allowedActions.includes('CONTACT_MANUAL');
  return canPayPix || canPayBoleto || canContact ? { kind: 'action_required', title: 'Aguardando pagamento', description: 'Utilize somente as instruções válidas desta compra.', canPayPix, canPayBoleto, canContact } :
    { ...none, kind: 'processing', title: 'Instruções de pagamento indisponíveis', description: 'A emissão ainda não foi confirmada. Aguarde a atualização; não refaça o pagamento.' };
}
