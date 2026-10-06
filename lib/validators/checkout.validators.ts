import { z } from 'zod';
import { validateCpfCnpj } from '@/lib/validators/cpf-cnpj';
import { checkoutAddressSchema } from '@/lib/commerce/checkout-address';

/**
 * Validação de número de cartão pelo algoritmo de Luhn (Mod 10).
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

const cartItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
  price: z.number().finite().nonnegative().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  variantId: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone deve ter no mínimo 10 dígitos'),
  cpfCnpj: z
    .string('CPF ou CNPJ é obrigatório para emissão do pagamento')
    .min(11, 'CPF ou CNPJ é obrigatório')
    .refine((val) => validateCpfCnpj(val), {
      message: 'CPF ou CNPJ inválido. Verifique os dígitos informados.',
    }),
  userId: z.string().optional(),
});

const addressSchema = z.object({
  state: z.string().min(2, 'Estado (UF) é obrigatório'),
  city: z.string().min(2, 'Cidade é obrigatória'),
  neighborhood: z.string().min(2, 'Bairro é obrigatório'),
  street: z.string().min(2, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
});

export const creditCardSchema = z
  .object({
    holderName: z.string().min(3, 'Nome impresso no cartão deve ter no mínimo 3 caracteres'),
    number: z
      .string()
      .min(13, 'Número do cartão inválido')
      .refine((val) => validateLuhn(val), {
        message: 'Número de cartão de crédito inválido.',
      }),
    expiryMonth: z
      .string()
      .regex(/^(0[1-9]|1[0-2])$/, 'Mês de validade inválido (01 a 12)'),
    expiryYear: z
      .string()
      .regex(/^\d{4}$/, 'Ano de validade inválido (4 dígitos)'),
    ccv: z.string().regex(/^\d{3,4}$/, 'Código de segurança (CVV) deve ter 3 ou 4 dígitos'),
  })
  .refine(
    (data) => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const year = parseInt(data.expiryYear, 10);
      const month = parseInt(data.expiryMonth, 10);
      if (year < currentYear) return false;
      if (year === currentYear && month < currentMonth) return false;
      return true;
    },
    { message: 'Cartão de crédito com data de validade expirada.' }
  );

export const checkoutDraftSchema = z
  .object({
    lojaID: z.string().min(1),
    cartID: z.string().uuid().optional(),
    cartVersion: z.number().int().nonnegative().optional(),
    basketID: z.string().uuid().optional(),
    customer: customerSchema,
    items: z.array(cartItemSchema).min(1).max(100),
    address: addressSchema.optional(), // Temporary translation for unambiguous older drafts.
    shippingAddress: checkoutAddressSchema.optional(),
    billingAddress: checkoutAddressSchema.optional(),
    billingSameAsShipping: z.boolean().optional(),
    deliveryType: z.enum(['DELIVERY', 'PICKUP', 'NONE']),
    freightQuoteToken: z.string().min(1).max(2048).optional(),
    freightValue: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
    shippingProvider: z.string().nullish(),
    shippingServiceName: z.string().nullish(),
    shippingEstimatedDays: z.number().int().nonnegative().nullish(),
    paymentMethod: z
      .enum(['PIX', 'CREDIT_CARD', 'BOLETO', 'WHATSAPP_PIX'])
      ,
    creditCard: creditCardSchema.optional(),
    installments: z.number().int().min(1).max(12).default(1).optional(),
    installmentValue: z.number().positive().optional(),
    acceptedFinancialTotal: z.number().finite().nonnegative().optional(),
    pixKey: z.string().optional(),
    pointsToRedeem: z.number().int().nonnegative().optional(),
  });
export const createOrderSchema = checkoutDraftSchema
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'CREDIT_CARD' && !data.creditCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creditCard'],
        message: 'Dados do cartão de crédito são obrigatórios para pagamento via cartão.',
      });
    }

    if (['BOLETO','CREDIT_CARD'].includes(data.paymentMethod) && !data.billingAddress &&
        !(data.billingSameAsShipping && data.deliveryType === 'DELIVERY' && data.shippingAddress) && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billingAddress'],
        message: 'Endereço de cobrança completo é obrigatório para este pagamento.',
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const completeCheckoutSchema = z.object({
  checkoutIntentID: z.string().uuid(), acceptedRevision: z.number().int().positive(),
  acceptedContentHash: z.string().regex(/^[a-f0-9]{64}$/), creditCard: creditCardSchema.optional(),
}).strict();
