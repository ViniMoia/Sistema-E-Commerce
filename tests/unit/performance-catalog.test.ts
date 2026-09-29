import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  catalogStateToProductFilters,
  parseCatalogSearchParams,
} from "@/lib/catalog-query";
import { getCatalogProductsPage } from "@/services/product.service";

vi.mock("@/lib/prisma", () => ({
  default: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe("catálogo paginado no servidor (PERF-001)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("limita a projeção da vitrine e não busca galeria/relações de detalhe", async () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({
      id: `produto-${index + 1}`,
    }));
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(rows as never);
    vi.mocked(prisma.product.count).mockResolvedValueOnce(500);

    const result = await getCatalogProductsPage({
      lojaId: "loja-a",
      page: 2,
      limit: 12,
      brandSlug: "marca-a",
    });

    expect(result).toMatchObject({
      total: 500,
      page: 2,
      pageSize: 12,
      hasNextPage: true,
    });
    expect(result.data).toHaveLength(12);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 13,
        skip: 12,
        where: expect.objectContaining({ lojaID: "loja-a" }),
        select: expect.not.objectContaining({ galleryUrls: expect.anything() }),
      })
    );
  });

  it("normaliza filtros da URL e os converte para a consulta autoritativa", () => {
    const state = parseCatalogSearchParams(
      new URLSearchParams(
        "brand=Marca-A&tag=externo,externo&tag=acessorios&q=polidor&price=50-100&page=3"
      )
    );

    expect(state).toEqual({
      brand: "marca-a",
      tags: ["externo", "acessorios"],
      search: "polidor",
      priceRange: "50-100",
      page: 3,
    });
    expect(catalogStateToProductFilters(state, "loja-a", 12)).toMatchObject({
      lojaId: "loja-a",
      brandSlug: "marca-a",
      tags: ["externo", "acessorios"],
      name: "polidor",
      minPrice: 50,
      maxPrice: 100,
      page: 3,
      limit: 12,
      sortBy: "relevance",
    });
  });

  it("mantém a home fora do caminho ilimitado e navega filtros pelo router", () => {
    const page = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    const hook = readFileSync(resolve(process.cwd(), "hooks/useProductFilters.ts"), "utf8");

    expect(page).toContain("getCatalogProductsPage(productFilters)");
    expect(page).not.toContain("all: true");
    expect(hook).toContain("router.replace(newUrl, { scroll: false })");
  });
});
