import { describe, it, expect } from "vitest";
import {
  canonicalizeVariant, getVariantOptions, isDefaultVariantTerm, resolveCatalogVariant,
} from "@/lib/product-variants";
import { createProductSchema, updateProductSchema } from "@/lib/validators/product";

const v = (id: string, size = "Único", color = "Padrão", stock = 10) => ({ id, size, color, stock });

describe("Seleção de variantes do catálogo", () => {
  it.each([null, undefined, "", " ", " ÚNICO ", "unico", "PADRÃO", "padrao", "Default"])(
    "reconhece o termo neutro %s", (term) => expect(isDefaultVariantTerm(term)).toBe(true),
  );
  it("normaliza valores neutros e preserva nomes comerciais", () => {
    expect(canonicalizeVariant(v("v", " Padrão ", "DEFAULT", -1))).toEqual(v("v", "Único", "Padrão", 0));
    expect(canonicalizeVariant(v("v", " 500ml ", " Preto "))).toEqual(v("v", "500ml", "Preto"));
  });
  it("permite comprar as duplicatas neutras do incidente sem seletores", () => {
    const variants = [v("original", "Padrão"), v("duplicate", "Padrão")];
    expect(getVariantOptions(variants).hasRealVariants).toBe(false);
    expect(resolveCatalogVariant(variants)?.id).toBe("original");
  });
  it("escolhe a duplicata disponível se a primeira não tem estoque", () => {
    expect(resolveCatalogVariant([v("a", "Único", "Padrão", 0), v("b")])?.id).toBe("b");
  });
  it("não solicita seleções para uma variante comercial única", () => {
    const variants = [v("single", "500ml", "Preto")];
    expect(getVariantOptions(variants).hasRealVariants).toBe(false);
    expect(resolveCatalogVariant(variants)?.id).toBe("single");
  });
  it("exige apenas tamanho para embalagens sem variação de cor", () => {
    const variants = [v("small", "500ml"), v("large", "1L")];
    expect(getVariantOptions(variants)).toMatchObject({ hasRealSizes: true, hasRealColors: false });
    expect(resolveCatalogVariant(variants)).toBeNull();
    expect(resolveCatalogVariant(variants, "1L")?.id).toBe("large");
  });
  it("exige apenas cor quando o tamanho é neutro", () => {
    const variants = [v("black", "Padrão", "Preto"), v("red", "Único", "Vermelho")];
    expect(getVariantOptions(variants)).toMatchObject({ hasRealSizes: false, hasRealColors: true });
    expect(resolveCatalogVariant(variants)).toBeNull();
    expect(resolveCatalogVariant(variants, null, "Preto")?.id).toBe("black");
  });
  it("exige ambas as dimensões para a grade comercial", () => {
    const variants = [v("a", "P", "Preto"), v("b", "M", "Azul")];
    expect(resolveCatalogVariant(variants, "P")).toBeNull();
    expect(resolveCatalogVariant(variants, null, "Preto")).toBeNull();
    expect(resolveCatalogVariant(variants, "P", "Azul")).toBeNull();
    expect(resolveCatalogVariant(variants, "M", "Azul")?.id).toBe("b");
  });
  it("deduplica opções por espaço, caixa e acento", () => {
    const variants = [v("a", "500ml", "Padrão"), v("b", " 500ML ", "default")];
    expect(getVariantOptions(variants).hasRealVariants).toBe(false);
  });
  it("mantém a opção neutra selecionável quando coexistir com uma opção comercial", () => {
    const variants = [v("standard"), v("large", "1L")];
    expect(getVariantOptions(variants).sizes).toEqual(["Único", "1L"]);
    expect(resolveCatalogVariant(variants, "Único")?.id).toBe("standard");
    expect(resolveCatalogVariant(variants, "1L")?.id).toBe("large");
  });
  it("não retorna combinações ausentes, inválidas ou esgotadas", () => {
    const variants = [v("a", "500ml"), v("b", "1L", "Padrão", 0)];
    expect(resolveCatalogVariant(variants, "2L")).toBeNull();
    expect(resolveCatalogVariant(variants, "1L")).toBeNull();
    expect(resolveCatalogVariant([])).toBeNull();
    expect(resolveCatalogVariant([v("empty", "Único", "Padrão", 0)])).toBeNull();
  });
});

describe("Validação de variantes na API e no Admin", () => {
  it("preserva o ID opcional na atualização", () => {
    expect(updateProductSchema.parse({ variants: [v("persisted")] }).variants[0].id).toBe("persisted");
    expect(updateProductSchema.safeParse({ variants: [{ size: "Único", color: "Padrão", stock: 1 }] }).success).toBe(true);
  });
  it("rejeita duplicatas normalizadas no cadastro e na edição", () => {
    const variants = [v("a", " Único "), v("b", "PADRAO", "default")];
    expect(updateProductSchema.safeParse({ variants }).success).toBe(false);
    expect(createProductSchema.safeParse({
      name: "Produto", description: "Descrição do produto", price: 10,
      imageUrl: "https://example.com/p.png", stock: 10, variants,
    }).success).toBe(false);
  });
  it("rejeita IDs repetidos, dimensões vazias e remoção de todas as variantes", () => {
    expect(updateProductSchema.safeParse({ variants: [v("a", "P"), v("a", "M")] }).success).toBe(false);
    expect(updateProductSchema.safeParse({ variants: [v("a", " ")] }).success).toBe(false);
    expect(updateProductSchema.safeParse({ variants: [] }).success).toBe(false);
    expect(updateProductSchema.safeParse({ name: "Novo nome" }).success).toBe(true);
  });
});
