import { z } from "zod";
import { externalImageUrlSchema } from "@/lib/validators/image-url";

/**
 * Aceita URL externa validada (http/https sem credenciais) ou caminho estático local sob /hero/.
 * Nunca aceita data:, blob: ou travessia de diretório.
 */
export const heroAssetUrlSchema = z.union([
  externalImageUrlSchema,
  z
    .string()
    .trim()
    .regex(
      /^\/hero\/[a-zA-Z0-9._-]+$/,
      "Caminho estático inválido; use /hero/<arquivo> ou uma URL HTTP/HTTPS"
    ),
]);

export const heroSlideKindSchema = z.enum([
  "ART_PANEL",
  "PRODUCT_ART",
  "BRAND_COLLECTION",
]);

export const heroOverlayModeSchema = z.enum(["NONE", "MINIMAL_DOCK"]);

export const heroAnchorTargetSchema = z.enum([
  "#catalogo",
  "#apresentacao",
  "#localizacao",
]);

export const heroSlideSchema = z.object({
  id: z.string().trim().min(1, "ID do slide é obrigatório").max(64),
  order: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  kind: heroSlideKindSchema.default("ART_PANEL"),
  desktopImageUrl: heroAssetUrlSchema,
  mobileImageUrl: heroAssetUrlSchema.optional().nullable(),
  altText: z
    .string()
    .trim()
    .min(3, "Texto alternativo deve ter ao menos 3 caracteres")
    .max(220),
  productId: z.string().uuid("ID de produto inválido").optional().nullable(),
  brandSlug: z.string().trim().max(80).optional().nullable(),
  tagSlug: z.string().trim().max(80).optional().nullable(),
  overlayMode: heroOverlayModeSchema.default("NONE"),
  ctaLabel: z.string().trim().max(40).optional().nullable(),
  anchorTarget: heroAnchorTargetSchema.optional().nullable(),
});

export const heroSlidesArraySchema = z
  .array(heroSlideSchema)
  .max(10, "Máximo de 10 painéis permitidos no carrossel Hero");

export type HeroSlideConfig = z.infer<typeof heroSlideSchema>;
export type HeroSlideKind = z.infer<typeof heroSlideKindSchema>;
export type HeroOverlayMode = z.infer<typeof heroOverlayModeSchema>;

/**
 * Painéis oficiais padrão da Continental enquanto a loja não possuir
 * configuração personalizada salva em Loja.heroSlides.
 */
export const DEFAULT_CONTINENTAL_HERO_SLIDES: HeroSlideConfig[] = [
  {
    id: "continental-panel-1",
    order: 0,
    active: true,
    kind: "ART_PANEL",
    desktopImageUrl:
      "https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/3_hzfdbp.png",
    mobileImageUrl: null,
    altText: "Painel Continental Estética Automotiva — Produtos e Marcas em Destaque",
    productId: null,
    brandSlug: null,
    tagSlug: null,
    overlayMode: "NONE",
    ctaLabel: "Explorar Catálogo",
    anchorTarget: "#catalogo",
  },
  {
    id: "continental-panel-2",
    order: 1,
    active: true,
    kind: "ART_PANEL",
    desktopImageUrl:
      "https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/4_fl1aqd.png",
    mobileImageUrl: null,
    altText: "Painel Continental — Linha Automotiva Profissional",
    productId: null,
    brandSlug: null,
    tagSlug: null,
    overlayMode: "NONE",
    ctaLabel: "Explorar Catálogo",
    anchorTarget: "#catalogo",
  },
  {
    id: "continental-panel-3",
    order: 2,
    active: true,
    kind: "ART_PANEL",
    desktopImageUrl:
      "https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/2_grdpdk.jpg",
    mobileImageUrl: null,
    altText: "Painel Continental — Marcas Parceiras e Alta Performance",
    productId: null,
    brandSlug: null,
    tagSlug: null,
    overlayMode: "NONE",
    ctaLabel: "Explorar Catálogo",
    anchorTarget: "#catalogo",
  },
];
