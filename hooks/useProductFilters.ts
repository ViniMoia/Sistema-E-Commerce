"use client";

import { useState, useMemo, useCallback } from "react";
import { BrandSummary } from "@/components/catalog/BrandHoverFlyout";

export interface FilterableProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  stock: number;
  galleryUrls?: string[];
  productVariants?: Array<{
    id: string;
    size: string;
    color: string;
    stock: number;
  }>;
  brandName?: string | null;
  brandSlug?: string | null;
  tags?: string[];
}

export interface UseProductFiltersOptions {
  initialProducts: FilterableProduct[];
  initialBrands?: BrandSummary[];
}

export interface UseProductFiltersReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedBrand: string | null;
  setSelectedBrand: (brandSlug: string | null) => void;
  selectedTags: string[];
  handleToggleTag: (tagSlug: string) => void;
  handleClearAllFilters: () => void;
  brandsWithCounts: BrandSummary[];
  filteredProducts: FilterableProduct[];
  hasActiveFilters: boolean;
  totalCount: number;
  filteredCount: number;
}

// Regras de detecção semântica em caso de fallback (produtos sem tag persistida no banco)
const TAG_REGEX: Record<string, RegExp> = {
  acessorios:
    /\b(APLICADOR|ESCOVA|PINCEL|MICROFIBRA|PULVERIZADOR|BORRIFADOR|SNOW FOAM|ADAPTADOR|FITA|LUVAS|ESPONJA|BALDE|GRELHA|PANO)\b/i,
  airless:
    /\b(AIRLESS|PISTOLA DE PINTURA|BICO AIRLESS|PULVERIZADOR DE ALTA PRESSAO)\b/i,
  aspiradores: /\b(ASPIRADOR|ECOCLEAN|LITE 1200W|PO E AGUA|ASPIRACAO)\b/i,
  boinas: /\b(BOINA|CORTE|REFINO|LUSTRO|ESPUMA|LÃ|INTERFACE|HEX)\b/i,
  "ceras-e-selantes":
    /\b(CERA|SELANTE|GRAFENO|VITRIFICADOR|SIO2|COATING|ROOTZ|BLEND|NATIVE|CARNAUBA|GLAZE)\b/i,
  "cheirinho-para-carro":
    /\b(AROMATIZANTE|CHEIRINHO|ODORIZADOR|SPRAY OLFATIVO|FRAGRANCIA|ESSENCIA|PERFUME|LITTLE TREES)\b/i,
  compressor: /\b(COMPRESSOR|PNEUMATICO|MANGUEIRA AR|CALIBRADOR)\b/i,
  externo:
    /\b(PNEUS|RODAS|LATARIA|VIDROS|CHASSI|MOTOR|ALUMAX|DESINCRUSTANTE|ACIDO|SHAMPOO|LAVA AUTOS|VERNIZ DE MOTOR|RESTAURADOR DE PLASTICOS|V-PLASTIC|DELET|D-RET)\b/i,
  extratoras:
    /\b(EXTRATORA|LAVADORA DE ESTOFADOS|IPC CARPET|SANITIZADORA|LAVA ESTOFADOS)\b/i,
  interno:
    /\b(COURO|PAINEL|PLASTICOS INTERNOS|ESTOFADOS|HIGIENIZADOR|APC INTERIORES|SINTRA|BACTRON|FLOAT|PLURI)\b/i,
  "kit-de-produtos": /\b(KIT|COMBO|TRIO|CONJUNTO|PCT|PACK)\b/i,
};

const BRAND_REGEX: Record<string, RegExp> = {
  vonixx:
    /\b(VONIXX|ROOTZ|SINTRA|BLEND|NATIVE|DELET|ALUMAX|PRISMA|V-PLASTIC|V-LIGHT|V-PAINT|V-ENERGY|VERONA)\b/i,
  easytech:
    /\b(EASYTECH|EASY TECH|INSIGNIA|PLASTI COAT|QUARTZ 9H|FLOAT|ZAP|MELT)\b/i,
  cadillac: /\b(CADILLAC|CADMIX|MONSTER CARNAUBA|BLACK MAGIC)\b/i,
  lincoln: /\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN)\b/i,
  kers: /\b(KERS|POLITRIZ KERS)\b/i,
  nobrecar: /\b(NOBRECAR|NOBRE CAR)\b/i,
  zacs: /\b(ZACS)\b/i,
  ipc: /\b(IPC|ECOCLEAN|CARPET)\b/i,
  karcher: /\b(KARCHER|KÄRCHER)\b/i,
  wap: /\b(WAP)\b/i,
};

/**
 * Hook de domínio responsável exclusivamente pela lógica de filtragem,
 * contadores de marcas e busca textual do catálogo de produtos (SRP).
 */
export function useProductFilters({
  initialProducts,
  initialBrands = [],
}: UseProductFiltersOptions): UseProductFiltersReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleToggleTag = useCallback((slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    );
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSelectedBrand(null);
    setSelectedTags([]);
    setSearchQuery("");
  }, []);

  // Contagem dinâmica e em tempo real por marca para exibição precisa no Flyout
  const brandsWithCounts = useMemo(() => {
    return initialBrands.map((b) => {
      const count = initialProducts.filter((p) => {
        const text = `${p.name} ${p.description || ""}`;
        return p.brandSlug === b.slug || BRAND_REGEX[b.slug]?.test(text);
      }).length;
      return { ...b, productCount: count > 0 ? count : b.productCount };
    });
  }, [initialBrands, initialProducts]);

  // Cálculo derivado dos produtos filtrados
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((prod) => {
      const text = `${prod.name} ${prod.description || ""}`;

      // 1. Busca textual
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          prod.name.toLowerCase().includes(q) ||
          prod.description.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Filtro de Marca
      if (selectedBrand) {
        const hasDbBrand = prod.brandSlug === selectedBrand;
        const hasRegexBrand = BRAND_REGEX[selectedBrand]?.test(text);
        if (!hasDbBrand && !hasRegexBrand) return false;
      }

      // 3. Filtro de Tags (Cumulativo / Inclusivo)
      if (selectedTags.length > 0) {
        const matchesAnyTag = selectedTags.some((tagSlug) => {
          const hasDbTag = prod.tags?.includes(tagSlug);
          const hasRegexTag = TAG_REGEX[tagSlug]?.test(text);
          return hasDbTag || hasRegexTag;
        });
        if (!matchesAnyTag) return false;
      }

      return true;
    });
  }, [initialProducts, searchQuery, selectedBrand, selectedTags]);

  const hasActiveFilters = Boolean(
    selectedBrand || selectedTags.length > 0 || searchQuery
  );

  return {
    searchQuery,
    setSearchQuery,
    selectedBrand,
    setSelectedBrand,
    selectedTags,
    handleToggleTag,
    handleClearAllFilters,
    brandsWithCounts,
    filteredProducts,
    hasActiveFilters,
    totalCount: initialProducts.length,
    filteredCount: filteredProducts.length,
  };
}
