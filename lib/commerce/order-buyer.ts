import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const buyerSelect = { id: true, name: true, email: true, phone: true, cpfCnpj: true, authenticatedUserID: true, deliveryAddress: true, billingAddress: true } as const;
export const buyerInputSchema = z.object({
  name: z.string().trim().min(2).max(150), email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().transform(value => value.replace(/\D/g, '')).pipe(z.string().max(20)),
  cpfCnpj: z.string().nullable().optional(),
});
export const buyerAddressSchema = z.object({ cep: z.string(), state: z.string(), city: z.string(), neighborhood: z.string(),
  street: z.string(), number: z.string(), complement: z.string().optional() });

export function newGuestOrderAccess() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashGuestOrderAccess(token), expiresAt: new Date(Date.now() + 7 * 86400000) };
}
export function hashGuestOrderAccess(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function validGuestOrderAccess(token: string | null | undefined, buyer: { recoveryTokenHash: string | null; recoveryExpiresAt: Date | null } | null | undefined) {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token) || !buyer?.recoveryTokenHash || !/^[a-f0-9]{64}$/.test(buyer.recoveryTokenHash)
    || !buyer.recoveryExpiresAt || buyer.recoveryExpiresAt.getTime() <= Date.now()) return false;
  return timingSafeEqual(Buffer.from(hashGuestOrderAccess(token), 'hex'), Buffer.from(buyer.recoveryTokenHash, 'hex'));
}
export function orderCustomer(order: {
  buyer?: { name: string; email?: string; phone?: string | null; cpfCnpj?: string | null; authenticatedUserID?: string | null } | null;
  user?: { id?: string; name: string; email?: string; phone?: string | null; cpfCnpj?: string | null } | null;
}) {
  return { id: order.buyer?.authenticatedUserID ?? order.user?.id ?? null,
    name: order.buyer?.name ?? order.user?.name ?? 'Cliente', email: order.buyer?.email ?? order.user?.email ?? '',
    phone: order.buyer?.phone ?? order.user?.phone ?? null, cpfCnpj: order.buyer?.cpfCnpj ?? order.user?.cpfCnpj ?? null };
}
export function snapshotDeliveryAddress(buyer: { deliveryAddress: unknown } | null | undefined) {
  const parsed = buyerAddressSchema.safeParse(buyer?.deliveryAddress);
  if (!parsed.success) return null;
  return { ...parsed.data, district: parsed.data.neighborhood, complement: parsed.data.complement ?? null };
}
