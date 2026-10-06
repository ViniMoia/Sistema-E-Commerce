import { z } from 'zod';

const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export const checkoutAddressSchema = z.object({
  state: z.string().trim().toUpperCase().refine(v => (states as readonly string[]).includes(v), 'UF inválida'),
  city: z.string().trim().min(2, 'Cidade é obrigatória'),
  neighborhood: z.string().trim().min(2, 'Bairro é obrigatório'),
  street: z.string().trim().min(2, 'Rua é obrigatória'),
  number: z.string().trim().min(1, 'Número é obrigatório'),
  complement: z.string().trim().optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
});
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;
type AddressInput = { deliveryType: string; paymentMethod?: string; address?: CheckoutAddress;
  shippingAddress?: CheckoutAddress; billingAddress?: CheckoutAddress; billingSameAsShipping?: boolean };

/** Legacy address is translated only while neither explicit address is supplied.
 * Explicit reuse is required by the new contract; pickup never becomes delivery. */
export function checkoutAddresses(input: AddressInput) {
  const legacy = input.address && input.shippingAddress === undefined && input.billingAddress === undefined && input.billingSameAsShipping === undefined;
  const shipping = input.deliveryType === 'DELIVERY' ? input.shippingAddress ?? (legacy ? input.address : undefined) : undefined;
  if (input.deliveryType !== 'DELIVERY' && input.shippingAddress) throw new Error('FREIGHT_SHIPPING_ADDRESS_NOT_ALLOWED');
  if (input.billingSameAsShipping && (!shipping || input.billingAddress)) throw new Error('PAYMENT_BILLING_ADDRESS_CONFLICT');
  const billing = input.billingSameAsShipping ? shipping : input.billingAddress ?? (legacy ? input.address : undefined);
  if (input.deliveryType === 'DELIVERY' && !shipping) throw new Error('FREIGHT_ADDRESS_REQUIRED');
  if (['CREDIT_CARD','BOLETO'].includes(input.paymentMethod ?? '') && !billing) throw new Error(input.paymentMethod === 'BOLETO' ? 'PAYMENT_BOLETO_BILLING_REQUIRED' : 'PAYMENT_CARD_BILLING_REQUIRED');
  const normalize = (address: CheckoutAddress) => ({ ...checkoutAddressSchema.parse(address), cep: address.cep.replace(/\D/g, '') });
  return { shippingAddress: shipping ? normalize(shipping) : undefined, billingAddress: billing ? normalize(billing) : undefined };
}
