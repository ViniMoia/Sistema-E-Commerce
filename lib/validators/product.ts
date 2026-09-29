import { z } from "zod";

export const productVariantSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1, "Tamanho é obrigatório"),
  color: z.string().min(1, "Cor é obrigatória"),
  stock: z.number().int().min(0, "Estoque não pode ser negativo"),
});

export const productFiltersSchema = z.object({
  name: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
  lojaId: z.string().max(100).optional(),
  brandSlug: z.string().trim().max(100).optional(),
  tags: z
    .union([
      z.array(z.string().trim().min(1).max(100)).max(20),
      z.string().max(1000).transform((str) => str.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20))
    ])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  cursor: z.string().uuid().optional(),
  sortBy: z.enum(["relevance", "price_asc", "price_desc", "newest"]).optional().default("newest"),
}).strict().superRefine((value, context) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
    context.addIssue({
      code: "custom",
      path: ["maxPrice"],
      message: "maxPrice deve ser maior ou igual a minPrice",
    });
  }
  if (value.cursor && value.page !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["page"],
      message: "Use cursor ou page, não ambos",
    });
  }
});

export const catalogFilterQuerySchema = productFiltersSchema;

export const createProductSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  price: z.number().min(0.01, "Preço deve ser maior que zero"),
  imageUrl: z.string().url("URL da imagem inválida"),
  galleryUrls: z.array(z.string().url("URL inválida na galeria")).optional().default([]),
  stock: z.number().int().min(0),
  lojaID: z.string().uuid("ID da loja inválido").optional(),
  variants: z.array(productVariantSchema).min(1, "O produto deve ter pelo menos uma variação"),
});

export const updateProductSchema = createProductSchema.partial().extend({
  variants: z.array(productVariantSchema).optional(),
});
