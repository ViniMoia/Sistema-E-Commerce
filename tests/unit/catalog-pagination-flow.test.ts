import { describe, it, expect } from "vitest";
import { getPaginationRange } from "@/components/catalog/CatalogPagination";
import { DEFAULT_PAGE_SIZE } from "@/hooks/useProductFilters";

describe("Fluxo de Paginação do Catálogo (12 cards/página - SOLID & Bounds Clamping)", () => {
  describe("Constantes & Particionamento Matemático", () => {
    it("deve usar o tamanho padrão de 12 itens por página", () => {
      expect(DEFAULT_PAGE_SIZE).toBe(12);
    });

    it("deve calcular exatamente 44 páginas para 521 produtos", () => {
      const totalItems = 521;
      const totalPages = Math.max(1, Math.ceil(totalItems / DEFAULT_PAGE_SIZE));
      expect(totalPages).toBe(44);
    });

    it("deve calcular fatias corretas para a primeira e última página", () => {
      const totalItems = 521;
      const mockItems = Array.from({ length: totalItems }, (_, i) => ({ id: i + 1 }));

      // Página 1 (12 itens: 1 a 12)
      const page1 = mockItems.slice(0, 12);
      expect(page1.length).toBe(12);
      expect(page1[0].id).toBe(1);
      expect(page1[11].id).toBe(12);

      // Página 44 (5 itens restantes: 517 a 521)
      const page44Start = (44 - 1) * 12; // 516
      const page44 = mockItems.slice(page44Start, page44Start + 12);
      expect(page44.length).toBe(5);
      expect(page44[0].id).toBe(517);
      expect(page44[4].id).toBe(521);
    });

    it("deve aplicar bounds clamping seguro para páginas negativas ou superiores ao total", () => {
      const totalPages = 44;

      const clampPage = (page: number) => {
        const target = Math.floor(Number(page) || 1);
        return Math.min(Math.max(1, target), totalPages);
      };

      expect(clampPage(-5)).toBe(1);
      expect(clampPage(0)).toBe(1);
      expect(clampPage(NaN)).toBe(1);
      expect(clampPage(1)).toBe(1);
      expect(clampPage(25)).toBe(25);
      expect(clampPage(44)).toBe(44);
      expect(clampPage(99999)).toBe(44);
    });
  });

  describe("Algoritmo de Janela Numérica com Reticências (getPaginationRange)", () => {
    it("deve retornar todos os números quando total de páginas for <= 7", () => {
      const range = getPaginationRange(3, 5);
      expect(range).toEqual([1, 2, 3, 4, 5]);
    });

    it("deve exibir reticências apenas no fim quando a página atual estiver no início (<= 4)", () => {
      const rangePage1 = getPaginationRange(1, 44);
      expect(rangePage1).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 44]);

      const rangePage4 = getPaginationRange(4, 44);
      expect(rangePage4).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 44]);
    });

    it("deve exibir reticências nos dois lados quando a página atual estiver no meio", () => {
      const rangePage10 = getPaginationRange(10, 44);
      expect(rangePage10).toEqual([1, "ellipsis-start", 9, 10, 11, "ellipsis-end", 44]);

      const rangePage20 = getPaginationRange(20, 44);
      expect(rangePage20).toEqual([1, "ellipsis-start", 19, 20, 21, "ellipsis-end", 44]);
    });

    it("deve exibir reticências apenas no início quando a página atual estiver no final (>= total - 3)", () => {
      const rangePage41 = getPaginationRange(41, 44);
      expect(rangePage41).toEqual([1, "ellipsis-start", 40, 41, 42, 43, 44]);

      const rangePage44 = getPaginationRange(44, 44);
      expect(rangePage44).toEqual([1, "ellipsis-start", 40, 41, 42, 43, 44]);
    });

    it("deve manter sempre no máximo 7 slots visíveis no desktop para estabilidade visual", () => {
      for (let p = 1; p <= 44; p++) {
        const range = getPaginationRange(p, 44);
        expect(range.length).toBe(7);
      }
    });
  });
});
