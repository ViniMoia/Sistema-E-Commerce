import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { requirePurchaseAccount } from '@/lib/commerce/account-scope';
import { CommerceLocks } from '@/lib/commerce/locks';
import { cartMutationSchema, cartAbsoluteMutationSchema, type CartMutation } from '@/lib/commerce/cart-command';
import { resolveCatalogVariant } from '@/lib/product-variants';

export class CartError extends Error {
  constructor(message: string, public readonly code: 'INVALID_INPUT' | 'CONFLICT' = 'INVALID_INPUT') { super(message); this.name = 'CartError'; }
}
async function account(tx: Prisma.TransactionClient, userID: string, lojaID?: string) {
  try { return await requirePurchaseAccount(tx, userID, lojaID); }
  catch { throw new CartError('Conta inválida ou não pertence à loja ativa.'); }
}
function quantity(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 99) throw new CartError('Quantidade deve ser um inteiro entre 1 e 99.');
  return value;
}
const cartInclude = { items: { include: {
  product: { select: { lojaID: true, price: true, name: true, imageUrl: true, loja: { select: { slug: true } } } }, variant: true,
} } } satisfies Prisma.CartInclude;
type Cart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
function validateCart(cart: Cart, userID: string, lojaID: string) {
  if (cart.userID !== userID || cart.lojaID !== lojaID || cart.items.some(item => item.lojaID !== lojaID || item.product.lojaID !== lojaID || item.variant.ProductID !== item.productID)) {
    throw new CartError('Carrinho com vínculos inconsistentes: compra bloqueada.');
  }
}
async function activeCart(tx: Prisma.TransactionClient, userID: string, lojaID: string) {
  const carts = await tx.cart.findMany({ where: { userID, lojaID, status: 'ACTIVE' }, include: cartInclude, take: 2 });
  if (carts.length > 1) throw new CartError('Mais de um carrinho ativo: reconciliação necessária.', 'CONFLICT');
  const cart = carts[0]; if (cart) validateCart(cart, userID, lojaID);
  return cart;
}
function serialize(cart: Cart, replay = false) {
  return { ...cart, replay, shippingCost: cart.shippingCost === null ? null : Number(cart.shippingCost),
    items: cart.items.map(item => { const { variant: _variant, ...data } = item; return { ...data,
      price: Number(item.product.price ?? item.price), productName: item.product.name ?? item.productName, imageUrl: item.product.imageUrl ?? item.imageUrl }; }) };
}
export async function getCart(userID: string, lojaID?: string) {
  return prisma.$transaction(async tx => {
    const user = await account(tx, userID, lojaID); const locks = new CommerceLocks(tx);
    await locks.acquireCartOwner(user.lojaID, userID);
    const initial = await activeCart(tx, userID, user.lojaID); if (!initial) return null;
    await locks.acquire('cart', [initial.id]);
    const cart = await tx.cart.findUniqueOrThrow({ where: { id: initial.id }, include: cartInclude });
    validateCart(cart, userID, user.lojaID);
    return cart.status === 'ACTIVE' ? serialize(cart) : null;
  });
}

function command(raw: unknown, absolute: boolean) {
  const result = (absolute ? cartAbsoluteMutationSchema : cartMutationSchema).safeParse(raw);
  if (!result.success) throw new CartError(absolute ? 'Mutação exige commandId, cartId e expectedVersion válidos.' : 'Inclusão exige commandId válido.');
  if (result.data.expectedVersion !== undefined && !result.data.cartId) throw new CartError('Revisão exige a identidade do carrinho.');
  return result.data;
}
async function mutationTransaction<T>(execute: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(execute); }
    catch (error) {
      const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : null;
      const activeCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' &&
        (target === 'Cart_active_owner_key' || (Array.isArray(target) && target.includes('lojaID') && target.includes('userID')));
      // Never continue an aborted SQL transaction. A writer outside the owner
      // protocol may win creation: redo authorization/reads in one fresh attempt.
      if (!activeCollision || attempt >= 1) throw error;
    }
  }
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function begin(tx: Prisma.TransactionClient, userID: string, lojaID: string | undefined, input: CartMutation, kind: 'ADD' | 'SET' | 'REMOVE', content: Array<string | number | null>) {
  const user = await account(tx, userID, lojaID); const locks = new CommerceLocks(tx);
  await locks.acquireCartOwner(user.lojaID, userID);
  const effectKey = `cart:${digest([user.lojaID, userID, input.commandId])}`;
  const contentHash = digest([kind, input.cartId ?? null, input.expectedVersion ?? null, ...content]);
  const receipt = await tx.auditLog.findUnique({ where: { effectKey } });
  if (receipt && (receipt.entity !== 'Cart' || receipt.actorId !== userID || (receipt.metadata as { contentHash?: string } | null)?.contentHash !== contentHash)) throw new CartError('Comando já utilizado com outro conteúdo.', 'CONFLICT');
  let initial = receipt ? await tx.cart.findUnique({ where: { id: receipt.entityId! }, include: cartInclude }) : await activeCart(tx, userID, user.lojaID);
  if (receipt && !initial) throw new CartError('Carrinho original não está mais disponível.', 'CONFLICT');
  if (!receipt && input.cartId && input.cartId !== initial?.id) throw new CartError('Carrinho alterado ou consumido; confira os dados atuais.', 'CONFLICT');
  if (!initial) {
    if (kind !== 'ADD') throw new CartError('Carrinho não está mais ativo.', 'CONFLICT');
    initial = await tx.cart.create({ data: { userID, lojaID: user.lojaID }, include: cartInclude });
  }
  await locks.acquire('cart', [initial.id]);
  const cart = await tx.cart.findUniqueOrThrow({ where: { id: initial.id }, include: cartInclude });
  validateCart(cart, userID, user.lojaID);
  if (!receipt && (cart.status !== 'ACTIVE' || (input.expectedVersion !== undefined && input.expectedVersion !== cart.version))) throw new CartError('Carrinho alterado ou consumido; rascunho preservado.', 'CONFLICT');
  return { cart, locks, user, effectKey, contentHash, commandId: input.commandId, parameters: content, replay: Boolean(receipt) };
}
async function complete(tx: Prisma.TransactionClient, context: Awaited<ReturnType<typeof begin>>, kind: string) {
  const { cart, user, effectKey, contentHash, commandId, parameters } = context;
  await tx.cart.update({ where: { id: cart.id, status: 'ACTIVE', version: cart.version }, data: { version: { increment: 1 } } });
  await tx.auditLog.create({ data: { action: 'CART_MUTATED', actorType: 'USER', actorId: user.id, targetId: user.id, entity: 'Cart', entityId: cart.id, effectKey,
    previousValue: { version: cart.version }, newValue: { version: cart.version + 1 }, metadata: { lojaID: user.lojaID, kind, commandId, parameters, contentHash } } });
  // Return a snapshot under the same lock, not an unrelated cart read by a second transaction.
  return serialize(await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
}
export async function addToCart(userID: string, data: { productID: string; variantID?: string | null; quantity: number; commandId?: string; cartId?: string; expectedVersion?: number }, lojaID?: string) {
  quantity(data.quantity);
  const input = command({ commandId: data.commandId, ...(data.cartId !== undefined ? { cartId: data.cartId } : {}), ...(data.expectedVersion !== undefined ? { expectedVersion: data.expectedVersion } : {}) }, false);
  return mutationTransaction(async tx => {
    const context = await begin(tx, userID, lojaID, input, 'ADD', [data.productID, data.variantID ?? null, data.quantity]);
    if (context.replay) return serialize(context.cart, true);
    const { locks, cart, user } = context;
    await locks.acquire('product', [data.productID]);
    const product = await tx.product.findUnique({ where: { id: data.productID }, include: { productVariants: true } });
    if (!product || product.lojaID !== user.lojaID || product.retiredAt) throw new CartError('Produto inválido ou não pertence a esta loja.');
    const variants = product.productVariants.filter(variant => !variant.retiredAt);
    const selected = data.variantID ? variants.find(variant => variant.id === data.variantID) : resolveCatalogVariant(variants);
    if (!selected) throw new CartError('Selecione uma variante válida e disponível do produto.');
    await locks.acquire('variant', [selected.id]);
    const variant = await tx.productVariants.findUniqueOrThrow({ where: { id: selected.id } });
    if (variant.ProductID !== product.id || variant.retiredAt) throw new CartError('Invalid product or variant');
    const item = cart.items.find(item => item.variantID === variant.id);
    const nextQuantity = quantity((item?.quantity ?? 0) + data.quantity);
    const productDemand = nextQuantity + cart.items.filter(row => row.productID === product.id && row.variantID !== variant.id).reduce((sum, row) => sum + row.quantity, 0);
    if (variant.stock < nextQuantity || product.stock < productDemand) throw new CartError('Insufficient stock');
    if (item) await tx.cartItem.update({ where: { id: item.id }, data: { quantity: nextQuantity, price: product.price } });
    else await tx.cartItem.create({ data: { cartID: cart.id, lojaID: user.lojaID, productID: product.id, variantID: variant.id,
      quantity: nextQuantity, color: variant.color, size: variant.size, price: product.price, productName: product.name, imageUrl: product.imageUrl } });
    return complete(tx, context, 'ADD');
  });
}
async function mutate(userID: string, variantID: string, lojaID: string | undefined, raw: unknown, newQuantity?: number) {
  if (newQuantity !== undefined) quantity(newQuantity);
  const input = command(raw, true); const kind = newQuantity === undefined ? 'REMOVE' : 'SET';
  return mutationTransaction(async tx => {
    const context = await begin(tx, userID, lojaID, input, kind, [variantID, newQuantity ?? null]);
    if (context.replay) return serialize(context.cart, true);
    const { cart, locks, user } = context;
    const item = cart.items.find(item => item.variantID === variantID);
    if (!item) throw new CartError('Item not found in cart');
    if (newQuantity !== undefined) {
      await locks.acquire('product', [item.productID]); await locks.acquire('variant', [variantID]);
      const variant = await tx.productVariants.findUniqueOrThrow({ where: { id: variantID }, include: { product: true } });
      if (variant.ProductID !== item.productID || variant.product.lojaID !== user.lojaID || variant.retiredAt || variant.product.retiredAt) throw new CartError('Produto ou variante indisponível.');
      const productDemand = newQuantity + cart.items.filter(row => row.productID === item.productID && row.variantID !== variantID).reduce((sum, row) => sum + row.quantity, 0);
      if (variant.stock < newQuantity || variant.product.stock < productDemand) throw new CartError('Insufficient stock');
      await tx.cartItem.update({ where: { id: item.id }, data: { quantity: newQuantity, price: variant.product.price } });
    } else await tx.cartItem.delete({ where: { id: item.id } });
    return complete(tx, context, kind);
  });
}
export async function updateCartItemQuantity(userID: string, variantID: string, value: number, lojaID?: string, mutation?: CartMutation) { return mutate(userID, variantID, lojaID, mutation, value); }
export async function removeFromCart(userID: string, variantID: string, lojaID?: string, mutation?: CartMutation) { return mutate(userID, variantID, lojaID, mutation); }
