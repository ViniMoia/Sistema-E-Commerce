import { describe, it, expect } from "vitest";
import { BRAND_REGEX, FilterableProduct } from "@/hooks/useProductFilters";

const MOCK_PRODUCTS: FilterableProduct[] = [
  {
    id: "prod-1",
    name: "CERA AUTO ESPELHAMENTO 500ML",
    price: 49.9,
    description: "Cera líquida de alto rendimento e brilho espelhado",
    imageUrl: "/img/auto1.jpg",
    stock: 10,
    galleryUrls: [],
    brandName: "Autoamerica",
    brandSlug: "autoamerica",
    tags: ["ceras-e-selantes", "externo"],
    productVariants: [],
  },
  {
    id: "prod-2",
    name: "FOAM GLOSS LAVA AUTO 3L",
    price: 79.9,
    description: "Shampoo automotivo de alta espumação",
    imageUrl: "/img/auto2.jpg",
    stock: 5,
    galleryUrls: [],
    brandName: "Autoamerica",
    brandSlug: "autoamerica",
    tags: ["externo"],
    productVariants: [],
  },
  {
    id: "prod-3",
    name: "BIG GLACO CRISTALIZADOR DE VIDROS 120ML",
    price: 99.0,
    description: "Repelente de água para vidros automotivos",
    imageUrl: "/img/glaco.jpg",
    stock: 8,
    galleryUrls: [],
    brandName: "Soft99",
    brandSlug: "soft99",
    tags: ["externo"],
    productVariants: [],
  },
  {
    id: "prod-4",
    name: "BALDE DETAILING TRANSPARENTE SGT",
    price: 65.0,
    description: "Balde com grelha separadora para lavagem segura",
    imageUrl: "/img/sgt.jpg",
    stock: 12,
    galleryUrls: [],
    brandName: "Sigma Tools",
    brandSlug: "sigma-tools",
    tags: ["acessorios"],
    productVariants: [],
  },
  {
    id: "prod-5",
    name: "CADILLAC APC INTERIORES 500ML",
    price: 35.0,
    description: "Limpador multiuso bactericida",
    imageUrl: "/img/cadillac.jpg",
    stock: 20,
    galleryUrls: [],
    brandName: "Cadillac",
    brandSlug: "cadillac",
    tags: ["interno"],
    productVariants: [],
  },
  {
    id: "prod-6",
    name: "VONIXX SINTRA FAST 500ML",
    price: 32.0,
    description: "Limpador flotador para couro e tecidos",
    imageUrl: "/img/vonixx.jpg",
    stock: 15,
    galleryUrls: [],
    brandName: "Vonixx",
    brandSlug: "vonixx",
    tags: ["interno"],
    productVariants: [],
  },
  // Produto órfão (brandSlug null), mas com nome característico
  {
    id: "prod-7",
    name: "SILICONE SPRAY PERFUMADO AMERICA 300ML",
    price: 25.0,
    description: "Finalizador de painel com perfume exclusivo",
    imageUrl: "/img/america.jpg",
    stock: 10,
    galleryUrls: [],
    brandName: null,
    brandSlug: null,
    tags: ["interno"],
    productVariants: [],
  },
  // Produto Lincoln órfão
  {
    id: "prod-8",
    name: "MASSA BRAZUCA POLIMENTO CORTE PESADO 500ML",
    price: 55.0,
    description: "Massa de polir de alta eficiência",
    imageUrl: "/img/brazuca.jpg",
    stock: 7,
    galleryUrls: [],
    brandName: null,
    brandSlug: null,
    tags: [],
    productVariants: [],
  },
];

// Função que emula a lógica canônica de filtragem de useProductFilters
function filterByBrand(products: FilterableProduct[], selectedBrand: string | null) {
  if (!selectedBrand) return products;
  return products.filter((prod) => {
    const text = `${prod.name} ${prod.description || ""}`;
    const hasDbBrand = prod.brandSlug === selectedBrand;
    const hasRegexBrand = BRAND_REGEX[selectedBrand]?.test(text);
    return hasDbBrand || hasRegexBrand;
  });
}

describe("Filtro de Marcas no Catálogo (Audit & Regression)", () => {
  it("deve conter regras ativas para todas as 18 marcas cadastradas", () => {
    const expectedBrands = [
      "autoamerica",
      "cadillac",
      "easytech",
      "ipc",
      "karcher",
      "kers",
      "lincoln",
      "meguiars",
      "nasiol",
      "nobrecar",
      "protelim",
      "sandet",
      "sigma-tools",
      "soft99",
      "sonax",
      "vonixx",
      "wap",
      "zacs",
    ];

    for (const slug of expectedBrands) {
      expect(BRAND_REGEX[slug], `Regex para marca '${slug}' deve estar definido`).toBeDefined();
      expect(BRAND_REGEX[slug]).toBeInstanceOf(RegExp);
    }
  });

  it("deve filtrar produtos da Autoamerica com sucesso via brandSlug e via regex semântico", () => {
    const filtered = filterByBrand(MOCK_PRODUCTS, "autoamerica");

    // Deve encontrar prod-1, prod-2 (via brandSlug) e prod-7 (via regex "AMERICA")
    expect(filtered.length).toBe(3);
    const names = filtered.map((p) => p.name);
    expect(names).toContain("CERA AUTO ESPELHAMENTO 500ML");
    expect(names).toContain("FOAM GLOSS LAVA AUTO 3L");
    expect(names).toContain("SILICONE SPRAY PERFUMADO AMERICA 300ML");
  });

  it("deve isolar marcas e não retornar produtos de outras fabricantes", () => {
    const filtered = filterByBrand(MOCK_PRODUCTS, "soft99");

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("BIG GLACO CRISTALIZADOR DE VIDROS 120ML");
  });

  it("deve reconhecer produtos Lincoln mesmo quando o produto for órfão e usar nome de linha (Brazuca)", () => {
    const filtered = filterByBrand(MOCK_PRODUCTS, "lincoln");

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("MASSA BRAZUCA POLIMENTO CORTE PESADO 500ML");
  });

  it("deve filtrar produtos da Sigma Tools com sucesso", () => {
    const filtered = filterByBrand(MOCK_PRODUCTS, "sigma-tools");

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("BALDE DETAILING TRANSPARENTE SGT");
  });

  it("deve restaurar todos os produtos ao desmarcar a marca (selecionar null)", () => {
    const cadillacFiltered = filterByBrand(MOCK_PRODUCTS, "cadillac");
    expect(cadillacFiltered.length).toBe(1);

    const cleared = filterByBrand(MOCK_PRODUCTS, null);
    expect(cleared.length).toBe(MOCK_PRODUCTS.length);
  });
});
