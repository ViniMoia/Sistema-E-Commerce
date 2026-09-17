import { z } from "zod";
import { validateCpfCnpj } from "@/lib/validators/cpf-cnpj";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
  password: z
    .string()
    .min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").trim(),
  email: z.string().email("E-mail inválido").trim().toLowerCase(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  phone: z.string().optional(),
  cpfCnpj: z
    .string()
    .optional()
    .refine(
      (val) => !val || validateCpfCnpj(val),
      "CPF ou CNPJ inválido"
    ),
  avatarImageUrl: z.string().url("URL de avatar inválida").optional().or(z.literal("")),
  address: z
    .object({
      cep: z.string().min(8, "CEP inválido"),
      state: z.string().min(2, "Estado inválido"),
      city: z.string().min(1, "Cidade é obrigatória"),
      district: z.string().min(1, "Bairro é obrigatório"),
      street: z.string().min(1, "Rua é obrigatória"),
      number: z.string().min(1, "Número é obrigatório"),
      complement: z.string().optional(),
    })
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
