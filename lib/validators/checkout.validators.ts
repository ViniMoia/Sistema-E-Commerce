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
  productId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(100),
  price: z.number().positive().max(10_000_000),
  color: z.string().max(80).optional(),
  size: z.string().max(80).optional(),
  variantId: z.string().max(100).optional(),
}).strict();

const customerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(150),
  email: z.string().email('E-mail inválido').max(255),
  phone: z.string().min(10, 'Telefone deve ter no mínimo 10 dígitos').max(20),
  cpfCnpj: z
    .string('CPF ou CNPJ é obrigatório para emissão do pagamento')
    .min(11, 'CPF ou CNPJ é obrigatório').max(20)
    .refine((val) => validateCpfCnpj(val), {
      message: 'CPF ou CNPJ inválido. Verifique os dígitos informados.',
    }),
  userId: z.string().max(100).optional(),
}).strict();

const addressSchema = z.object({
  state: z.string().min(2, 'Estado (UF) é obrigatório').max(2),
  city: z.string().min(2, 'Cidade é obrigatória').max(100),
  neighborhood: z.string().min(2, 'Bairro é obrigatório').max(100),
  street: z.string().min(2, 'Rua é obrigatória').max(150),
  number: z.string().min(1, 'Número é obrigatório').max(30),
  complement: z.string().max(100).optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
}).strict();

export const creditCardSchema = z
  .object({
    holderName: z.string().min(3, 'Nome impresso no cartão deve ter no mínimo 3 caracteres').max(150),
    number: z
      .string()
      .min(13, 'Número do cartão inválido')
      .max(25, 'Número do cartão inválido')
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
    lojaID: z.string().min(1).max(100),
    cartId: z.string().uuid('ID do carrinho inválido').optional(),
    customer: customerSchema,
    items: z.array(cartItemSchema).min(1).max(50, 'O pedido excede o limite de 50 itens.'),
    address: addressSchema.optional(),
    deliveryType: z.enum(['DELIVERY', 'PICKUP', 'NONE']),
    freightQuoteToken: z.string().min(32).max(4096).optional(),
    paymentMethod: z
      .enum(['PIX', 'CREDIT_CARD', 'BOLETO', 'WHATSAPP_PIX'])
      .default('PIX')
      .optional(),
    creditCard: creditCardSchema.optional(),
    installments: z.number().int().min(1).max(12).default(1).optional(),
    pointsToRedeem: z.number().int().nonnegative().max(100_000_000).optional(),
  }).strict()
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
