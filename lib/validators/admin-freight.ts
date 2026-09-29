import { z } from 'zod'

export const freightRuleFieldsSchema = z.object({
  cityName: z.string().trim().min(1, 'Nome da cidade é obrigatório').max(120),
  value: z.number().finite('Valor de frete deve ser finito').min(0, 'Valor de frete não pode ser negativo').max(1_000_000),
})

export const createFreightRuleSchema = freightRuleFieldsSchema.strict()

export const updateFreightRuleSchema = freightRuleFieldsSchema
  .partial()
  .strict()
  .refine((value) => value.cityName !== undefined || value.value !== undefined, {
    message: 'Informe ao menos um campo para atualização.',
  })
