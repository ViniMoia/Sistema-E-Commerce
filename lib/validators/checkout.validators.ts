import { z } from 'zod';
import { validateCpfCnpj } from '@/lib/validators/cpf-cnpj';

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
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
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

export const createOrderSchema = z
  .object({
    lojaID: z.string().min(1),
    customer: customerSchema,
    items: z.array(cartItemSchema).min(1),
    address: addressSchema.optional(),
    deliveryType: z.enum(['DELIVERY', 'PICKUP', 'NONE']),
    freightValue: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
    shippingProvider: z.string().optional(),
    shippingServiceName: z.string().optional(),
    shippingEstimatedDays: z.number().int().nonnegative().optional(),
    paymentMethod: z
      .enum(['PIX', 'CREDIT_CARD', 'BOLETO', 'WHATSAPP_PIX'])
      .default('PIX')
      .optional(),
    creditCard: creditCardSchema.optional(),
    installments: z.number().int().min(1).max(12).default(1).optional(),
    installmentValue: z.number().positive().optional(),
    pixKey: z.string().optional(),
    pointsToRedeem: z.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'CREDIT_CARD' && !data.creditCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creditCard'],
        message: 'Dados do cartão de crédito são obrigatórios para pagamento via cartão.',
      });
    }

    if (data.paymentMethod === 'BOLETO' && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'Endereço completo é obrigatório para emissão de boleto bancário.',
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
