import { Prisma } from '@prisma/client';
import { buyerInputSchema } from '@/lib/commerce/order-buyer';
import { CommerceLocks } from '@/lib/commerce/locks';
import { checkoutHash } from '@/lib/commerce/checkout-content';
import { resolveCatalogVariant, getVariantCombinationKey, canonicalizeVariant } from '@/lib/product-variants';
import { cleanDigits, validateCpfCnpj } from '@/lib/validators/cpf-cnpj';
import { creditCardSchema } from '@/lib/validators/checkout.validators';
import { acceptFreightQuote, authorizeFreeFreight } from '@/lib/freight/acceptance';
import { simulatePointsRedemption } from '@/services/loyalty.service';
import { paymentCapabilities } from '@/services/payment/capabilities.service';
import { buildFinancialPlan } from '@/services/payment/financial-plan.service';
import { asaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import type { CreateOrderParams } from './checkout.service';
import { checkoutAddresses } from '@/lib/commerce/checkout-address';

export async function prepareCheckout(tx: Prisma.TransactionClient, params: CreateOrderParams, quoting = false) {
  const buyer = buyerInputSchema.parse(params.customer);
  if (!params.items?.length || params.items.length > 100) throw new Error('CHECKOUT_ITEMS_INVALID');
  if (!params.paymentMethod) throw new Error('PAYMENT_METHOD_REQUIRED');
  if (!['DELIVERY', 'PICKUP', 'NONE'].includes(params.deliveryType)) throw new Error('FREIGHT_METHOD_INVALID');
  const addresses = checkoutAddresses(params);
  if (params.pointsToRedeem !== undefined && (!Number.isInteger(params.pointsToRedeem) || params.pointsToRedeem < 0)) throw new Error('CHECKOUT_POINTS_INVALID');
  const loja = await tx.loja.findUnique({ where: { id: params.lojaID } });
  if (!loja) throw new Error('CHECKOUT_TENANT_NOT_FOUND');
  const gateway = params.paymentGateway ?? asaasPaymentAdapter;
  const selectedMethod = params.paymentMethod;
  const capabilities = await paymentCapabilities(loja, gateway);
  if (!capabilities.methods.includes(selectedMethod)) throw new Error('PAYMENT_METHOD_UNAVAILABLE');
  if (selectedMethod !== 'WHATSAPP_PIX' && (!params.customer.cpfCnpj || !validateCpfCnpj(params.customer.cpfCnpj))) throw new Error('PAYMENT_CUSTOMER_REQUIRED');
  if (selectedMethod === 'CREDIT_CARD' && ((!quoting && !creditCardSchema.safeParse(params.creditCard).success) || !addresses.billingAddress)) throw new Error('PAYMENT_CARD_BILLING_REQUIRED');
  if (selectedMethod === 'BOLETO' && !addresses.billingAddress) throw new Error('PAYMENT_BOLETO_BILLING_REQUIRED');
  const locks = new CommerceLocks(tx);
  await locks.acquire('product', params.items.map(i => i.productId ?? ''));
  const items: Array<{ productId: string; variantId: string; name: string; color: string; size: string;
    quantity: number; price: Prisma.Decimal; catalogVersion: number }> = [];
  const quantities = new Map<string, number>();
  for (const input of params.items) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) throw new Error('CHECKOUT_QUANTITY_INVALID');
    const product = await tx.product.findUnique({ where: { id: input.productId }, include: { productVariants: true } });
    if (!product || product.lojaID !== params.lojaID || product.retiredAt) throw new Error('CHECKOUT_PRODUCT_UNAVAILABLE');
    const candidates = input.variantId ? product.productVariants.filter(v => v.id === input.variantId) : product.productVariants;
    const variant = resolveCatalogVariant(candidates, input.size, input.color);
    if (!variant || variant.retiredAt) throw new Error('CHECKOUT_VARIANT_UNAVAILABLE');
    if (!input.variantId && candidates.filter(v => !v.retiredAt && v.stock > 0 && getVariantCombinationKey(v) === getVariantCombinationKey(variant)).length !== 1) throw new Error('CHECKOUT_VARIANT_AMBIGUOUS');
    const existing = items.find(i => i.variantId === variant.id);
    const quantity = input.quantity + (existing?.quantity ?? 0);
    if (quantity > 99 || variant.stock < quantity) throw new Error('Estoque insuficiente para a variação selecionada.');
    const productQuantity = input.quantity + (quantities.get(product.id) ?? 0);
    quantities.set(product.id, productQuantity);
    if (product.stock < productQuantity) throw new Error('Estoque insuficiente para o produto.');
    if (existing) existing.quantity = quantity;
    else items.push({ productId: product.id, variantId: variant.id, quantity, name: product.name,
      color: canonicalizeVariant(variant).color, size: canonicalizeVariant(variant).size, price: product.price, catalogVersion: product.catalogVersion });
  }
  items.sort((a, b) => `${a.productId}:${a.variantId}` < `${b.productId}:${b.variantId}` ? -1 : 1);
  await locks.acquire('variant', items.map(i => i.variantId));
  const freight = params.deliveryType === 'DELIVERY' || params.freightQuoteToken
    ? await acceptFreightQuote(tx, { lojaID: params.lojaID, ownerKey: params.customer.userId ? `u:${params.customer.userId}` : params.freightOwnerKey,
      items, deliveryType: params.deliveryType, token: params.freightQuoteToken, address: addresses.shippingAddress })
    : await authorizeFreeFreight(tx, params.lojaID, params.deliveryType);
  const subtotal = items.reduce((sum, i) => sum.plus(i.price.times(i.quantity)), new Prisma.Decimal(0));
  let pointsRedeemed = 0, discount = new Prisma.Decimal(0);
  if (params.pointsToRedeem) {
    if (!loja.loyaltyEnabled) throw new Error('Programa de pontos desativado nesta loja.');
    if (!params.customer.userId) throw new Error('Autenticação obrigatória para usar pontos no checkout.');
    const sim = await simulatePointsRedemption({ lojaID: params.lojaID, userID: params.customer.userId,
      subtotal: Number(subtotal), requestedPoints: params.pointsToRedeem }, tx);
    if (!sim.eligible || sim.pointsToRedeem <= 0) throw new Error(sim.reason || 'Resgate não elegível.');
    pointsRedeemed = sim.pointsToRedeem; discount = new Prisma.Decimal(sim.discountValue);
  }
  const financial = buildFinancialPlan({ store: loja, method: selectedMethod, subtotal, discount, freight: freight.amount,
    eligible: !!params.customer.userId, count: params.installments ?? 1, config: capabilities.config,
    maximumInstallments: capabilities.maximumInstallments, requireConsent: !quoting,
    acceptedFinancialTotal: params.acceptedFinancialTotal, installmentValue: params.installmentValue });
  const address = addresses.shippingAddress ?? null;
  const normalized = { schemaVersion: 1, lojaID: params.lojaID, customer: { ...buyer, userId: params.customer.userId ?? null,
    cpfCnpj: params.customer.cpfCnpj ? cleanDigits(params.customer.cpfCnpj) : null }, address,
    shippingAddress: address, billingAddress: addresses.billingAddress ?? null,
    items: items.map(i => ({ ...i, price: i.price.toFixed(2) })), deliveryType: params.deliveryType,
    freight: { id: freight.id, amount: freight.amount.toFixed(2), provider: freight.provider,
      serviceName: freight.serviceName, estimatedDays: freight.estimatedDays, snapshot: freight.snapshot ?
        Object.fromEntries(Object.entries(freight.snapshot).filter(([k]) => k !== 'acceptedAt')) : null },
    financial: financial.plan, calculationRule: financial.rule, earn: financial.earn, pointsRedeemed,
    expiryPolicy: { version: 1, manualHours: 24, boletoConfirmationGraceHours: 72 },
    manualInstructions: selectedMethod === 'WHATSAPP_PIX' ? { pixKey: loja.pixKey!, whatsappNumber: loja.whatsappNumber! } : null,
    requestedPoints: params.pointsToRedeem ?? 0 };
  return { buyer, items, subtotal, discount, pointsRedeemed, financial, freight, loja, gateway, normalized, hash: checkoutHash(normalized) };
}
