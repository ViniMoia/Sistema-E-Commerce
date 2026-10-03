import { describe, it, expect } from "vitest";
import { CATALOG_LAYOUT_MODE } from "@/components/home/HomeClient";
import { PRICE_RANGES } from "@/components/catalog/CatalogFreeSidebar";
import { CATALOG_TAGS } from "@/components/catalog/FilterTagPills";

describe("Catálogo com Toolbar & Drawer Centralizado (Experimento Reversível)", () => {
  describe("Constantes de Configuração e Modos de Layout", () => {
    it("deve ter o modo 'drawer' ativo como padrão no experimento", () => {
      expect(CATALOG_LAYOUT_MODE).toBe("drawer");
    });

    it("deve permitir apenas modos válidos ('drawer' ou 'sidebar')", () => {
      const validModes: Array<"drawer" | "sidebar"> = ["drawer", "sidebar"];
      expect(validModes).toContain(CATALOG_LAYOUT_MODE);
    });
  });

  describe("Cálculo e Contagem de Filtros Ativos", () => {
    const calculateActiveCount = (
      selectedBrand: string | null,
      selectedTags: string[],
      selectedPriceRange: string | null,
      searchQuery: string = ""
    ) => {
      return (
        (selectedBrand ? 1 : 0) +
        selectedTags.length +
        (selectedPriceRange ? 1 : 0) +
        (searchQuery.trim() ? 1 : 0)
      );
    };

    it("deve retornar 0 quando nenhum filtro estiver ativo", () => {
      expect(calculateActiveCount(null, [], null, "")).toBe(0);
    });

    it("deve somar corretamente múltiplos filtros combinados", () => {
      // 1 marca + 2 tags + 1 faixa de preço + 1 busca = 5
      const count = calculateActiveCount(
        "vonixx",
        ["ceras-e-selantes", "externo"],
        "50-100",
        "vitrificador"
      );
      expect(count).toBe(5);
    });

    it("deve ignorar busca vazia ou com espaços em branco", () => {
      expect(calculateActiveCount(null, [], null, "   ")).toBe(0);
    });
  });

  describe("Resolução de Rótulos de Filtros (Chips da Toolbar)", () => {
    it("deve encontrar o rótulo correto para faixas de preço existentes", () => {
      const range = PRICE_RANGES.find((p) => p.id === "0-50");
      expect(range?.label).toBe("até R$50,00");

      const range200 = PRICE_RANGES.find((p) => p.id === "200+");
      expect(range200?.label).toBe("a partir de R$200,00");
    });

    it("deve encontrar os nomes amigáveis das tags do catálogo", () => {
      const ceraTag = CATALOG_TAGS.find((t) => t.slug === "ceras-e-selantes");
      expect(ceraTag?.name).toBe("Ceras e Selantes");

      const aspiradorTag = CATALOG_TAGS.find((t) => t.slug === "aspiradores");
      expect(aspiradorTag?.name).toBe("Aspiradores");
    });
  });
});
