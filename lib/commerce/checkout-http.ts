import { NextResponse } from 'next/server';
import { getLojaFromHeaders } from '@/lib/tenant';
import { getCurrentUser } from '@/lib/session';
import { freightOwnerForRequest } from '@/lib/freight/owner';
import { checkRateLimit } from '@/lib/rate-limit';
import { completeCheckoutSchema } from '@/lib/validators/checkout.validators';
import { createOrder } from '@/services/checkout.service';
import type { CheckoutScope } from '@/services/checkout-intent.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const headers = { 'Cache-Control': 'private, no-store' };
export function checkoutResponse(data: unknown, status = 200) { return NextResponse.json({ success: true, data }, { status, headers }); }
export function checkoutFailure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const known = /^(CHECKOUT_|PAYMENT_|FREIGHT_|ACCOUNT_ACCESS_DENIED|Estoque insuficiente|Autenticação obrigatória|Programa de pontos)/.test(message);
  const status = /NOT_FOUND$/.test(message) ? 404 : /ACCESS_DENIED|IDENTITY_REQUIRED/.test(message) ? 403 : known ? 409 :
    error instanceof SyntaxError || error instanceof z.ZodError ? 400 : 500;
  if (status === 500) logger.error('Falha interna no processamento da compra', undefined, { action: 'CHECKOUT_INTERNAL_FAILURE' });
  return NextResponse.json({ success: false, error: known ? message : status === 500 ? 'CHECKOUT_RESULT_UNAVAILABLE' : 'CHECKOUT_INPUT_INVALID' }, { status, headers });
}
export async function checkoutHttpScope(issueIdentity = false): Promise<CheckoutScope> {
  const loja = await getLojaFromHeaders(); if (!loja) throw new Error('CHECKOUT_TENANT_NOT_FOUND');
  const user = await getCurrentUser();
  if (user && (user.lojaID !== loja.id || user.status !== 'ACTIVE')) throw new Error('ACCOUNT_ACCESS_DENIED');
  const freightOwnerKey = await freightOwnerForRequest(loja.id, user, issueIdentity);
  if (!freightOwnerKey) throw new Error('CHECKOUT_IDENTITY_REQUIRED');
  return { lojaID: loja.id, customer: { userId: user?.id }, freightOwnerKey };
}
export async function completeCheckoutHttp(request: Request) {
  const limited = checkRateLimit(request, 'order_checkout', 15, 60000); if (limited) return limited;
  try {
    const scope = await checkoutHttpScope();
    const parsed = completeCheckoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      logger.warn('Contrato de conclusão de compra rejeitado', { action: 'CHECKOUT_INCOMPLETE_CONTRACT_REJECTED',
        tenantId: scope.lojaID, route: new URL(request.url).pathname });
      return NextResponse.json({ success: false, error: 'CHECKOUT_INTENT_REQUIRED', next: '/api/checkout/intents' }, { status: 422, headers });
    }
    const result = await createOrder({ ...parsed.data, ...scope,
      customer: { name: '', email: '', phone: '', userId: scope.customer.userId }, items: [], deliveryType: 'NONE' });
    return checkoutResponse(result, result.paymentState === 'PROCESSING' ? 202 : 200);
  } catch (error) { return checkoutFailure(error); }
}
