"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  lojaID?: string;
}

export interface UseProductFiltersOptions {
  initialProducts: FilterableProduct[];
  initialBrands?: BrandSummary[];
  enableUrlSync?: boolean;
}

export interface UseProductFiltersReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedBrand: string | null;
  setSelectedBrand: (brandSlug: string | null) => void;
  selectedTags: string[];
  handleToggleTag: (tagSlug: string) => void;
  selectedPriceRange: string | null;
  setSelectedPriceRange: (range: string | null) => void;
  selectedVoltage: string | null;
  setSelectedVoltage: (voltage: string | null) => void;
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
    /\b(APLICADOR|ESCOVA|PINCEL|MICROFIBRA|PULVERIZADOR|BORRIFADOR|SNOW FOAM|ADAPTADOR|FITA|LUVAS|ESPONJA|BALDE|GRELHA|PANO|CONECTOR|MANGUEIRA|ENGATE|BICO|CARRINHO|BANQUETA|BOQUILHA|SUPORTE|LANCETA|GATILHO|CANHAO|MEDIDOR|TOALHA|FITA CREPE|FRASCO|DILUIDOR|DISCO|PULVERIZACAO|PULVERIZADORA)\b/i,
  aspiradores:
    /\b(ASPIRADOR|ECOCLEAN|LITE 1200W|PO E AGUA|ASPIRACAO|BOCAL PARA ASPIRADOR)\b/i,
  boinas:
    /\b(BOINA|CORTE|REFINO|LUSTRO|ESPUMA|LÃ|INTERFACE|HEX|PIRAMIDAL|PRATO)\b/i,
  "ceras-e-selantes":
    /\b(CERA|SELANTE|GRAFENO|VITRIFICADOR|SIO2|COATING|ROOTZ|BLEND|NATIVE|CARNAUBA|GLAZE|PROTECAO CERAMICA|V-PAINT|PLASTICOAT|INSIGNIA|DIMENSION|CRISTALIZADOR|REVITALIZADOR|PROTECAO PINTURA|TITANIUM)\b/i,
  "cheirinho-para-carro":
    /\b(AROMATIZANTE|CHEIRINHO|ODORIZADOR|SPRAY OLFATIVO|FRAGRANCIA|ESSENCIA|PERFUME|LITTLE TREES|HOT ROD|CENTRAL SUL)\b/i,
  compressor:
    /\b(COMPRESSOR|PNEUMATICO|MANGUEIRA AR|CALIBRADOR|TORNADOR)\b/i,
  externo:
    /\b(PNEUS|PNEU|RODAS|RODA|LATARIA|VIDROS|VIDRO|CHASSI|MOTOR|ALUMAX|DESINCRUSTANTE|ACIDO|SHAMPOO|LAVA AUTOS|VERNIZ DE MOTOR|RESTAURADOR DE PLASTICOS|V-PLASTIC|DELET|D-RET|ACIDUS|AC2-PRO|ACID PRO|VEXUS|VINTRIX|VIDRY|ZMOL|BLACK MAGIC|BOLD|CLAYBAR|BARRA DESCONTAMINANTE|DESCONTAMINANTE|DESENGRAXANTE|PRETEADOR|REMOV|PICHE|ALCALINO|FERROSO|DESOXIDANTE|CHAMPION|DEMOLIDOR|PRISMA|CHUVA ACIDA|EMBLEMA|GRADE)\b/i,
  extratoras:
    /\b(EXTRATORA|LAVADORA DE ESTOFADOS|IPC CARPET|SANITIZADORA|LAVA ESTOFADOS|BOCAL EXTRATORA)\b/i,
  interno:
    /\b(COURO|PAINEL|PLASTICOS INTERNOS|ESTOFADOS|ESTOFADO|HIGIENIZADOR|APC|SINTRA|BACTRON|BACTRAN|FLOAT|PLURI|ARPUR|CLEAN-CAP|CLEAN-DEX|VERTEX|VERSE|DRESS|DISOLV|D-CLEAN|TECIDO|TECIDOS|CARPETE|TETO|ODOR)\b/i,
  "kit-de-produtos":
    /\b(KIT|COMBO|TRIO|CONJUNTO|PCT|PACK|JOGO|DUPLA)\b/i,
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
 * Utilitário seguro para extração de parâmetros de filtros a partir da URL.
 * Trata tanto query params padrão (?marca=...) quanto params acoplados ao hash (#catalogo?marca=...).
 */
function extractFiltersFromLocation(): {
  brand: string | null;
  tags: string[];
  search: string;
} {
  if (typeof window === "undefined") {
    return { brand: null, tags: [], search: "" };
  }

  // 1. Query params padrão (?marca=...)
  let searchParams = new URLSearchParams(window.location.search);

  // 2. Suporte resiliente a query após hash (#catalogo?marca=...)
  if (!searchParams.toString() && window.location.hash.includes("?")) {
    const hashQuery = window.location.hash.split("?")[1];
    if (hashQuery) {
      searchParams = new URLSearchParams(hashQuery);
    }
  }

  const brand =
    searchParams.get("marca") ||
    searchParams.get("brand") ||
    searchParams.get("brandSlug") ||
    null;

  const rawTags =
    searchParams.getAll("tags").concat(searchParams.getAll("tag")).join(",");
  const tags = rawTags
    ? rawTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const search =
    searchParams.get("busca") ||
    searchParams.get("search") ||
    searchParams.get("q") ||
    "";

  return {
    brand: brand ? brand.toLowerCase().trim() : null,
    tags,
    search: search.trim(),
  };
}

/**
 * Hook de domínio responsável exclusivamente pela lógica de filtragem,
 * contadores de marcas, busca textual e sincronização bidirecional com a URL (SRP & Deep Linking).
 */
export function useProductFilters({
  initialProducts,
  initialBrands = [],
  enableUrlSync = true,
}: UseProductFiltersOptions): UseProductFiltersReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
  const [selectedVoltage, setSelectedVoltage] = useState<string | null>(null);
  const isHydratedRef = useRef(false);

  // ─── 1. Deep Linking: Leitura Inicial dos Parâmetros da URL na Montagem ──────
  useEffect(() => {
    if (typeof window === "undefined" || !enableUrlSync) return;

    const initial = extractFiltersFromLocation();

    if (initial.brand) {
      setSelectedBrand(initial.brand);
    }
    if (initial.tags.length > 0) {
      setSelectedTags(initial.tags);
    }
    if (initial.search) {
      setSearchQuery(initial.search);
    }

    isHydratedRef.current = true;
  }, [enableUrlSync]);

  // ─── 2. Sincronização Reativa Bidirecional: Estado -> URL (replaceState) ─────
  useEffect(() => {
    if (typeof window === "undefined" || !enableUrlSync || !isHydratedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();

      if (selectedBrand) {
        params.set("marca", selectedBrand);
      }
      if (selectedTags.length > 0) {
        params.set("tags", selectedTags.join(","));
      }
      if (searchQuery.trim()) {
        params.set("busca", searchQuery.trim());
      }

      const queryString = params.toString();
      const currentHash = window.location.hash.split("?")[0] || "#catalogo";
      const pathname = window.location.pathname;

      const newUrl = queryString
        ? `${pathname}?${queryString}${currentHash}`
        : `${pathname}${currentHash}`;

      const currentFullUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (currentFullUrl !== newUrl) {
        window.history.replaceState(null, "", newUrl);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [selectedBrand, selectedTags, searchQuery, enableUrlSync]);

  // ─── 3. Suporte ao Histórico do Navegador (Botões Voltar/Avançar) ───────────
  useEffect(() => {
    if (typeof window === "undefined" || !enableUrlSync) return;

    const handlePopState = () => {
      const updated = extractFiltersFromLocation();
      setSelectedBrand(updated.brand);
      setSelectedTags(updated.tags);
      setSearchQuery(updated.search);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enableUrlSync]);

  // ─── 4. Handlers de Ação de Filtros ─────────────────────────────────────────
  const handleToggleTag = useCallback((slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    );
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSelectedBrand(null);
    setSelectedTags([]);
    setSelectedPriceRange(null);
    setSelectedVoltage(null);
    setSearchQuery("");
  }, []);

  // ─── 5. Contagem dinâmica e em tempo real por marca para o Flyout ────────────
  const brandsWithCounts = useMemo(() => {
    return initialBrands.map((b) => {
      const count = initialProducts.filter((p) => {
        const text = `${p.name} ${p.description || ""}`;
        return p.brandSlug === b.slug || BRAND_REGEX[b.slug]?.test(text);
      }).length;
      return { ...b, productCount: count > 0 ? count : b.productCount };
    });
  }, [initialBrands, initialProducts]);

  // ─── 6. Cálculo derivado dos produtos filtrados ──────────────────────────────
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

      // 4. Filtro por Faixa de Preço
      if (selectedPriceRange) {
        const price = prod.price;
        if (selectedPriceRange === "0-50" && price > 50) return false;
        if (selectedPriceRange === "50-100" && (price < 50 || price > 100)) return false;
        if (selectedPriceRange === "100-150" && (price < 100 || price > 150)) return false;
        if (selectedPriceRange === "150-200" && (price < 150 || price > 200)) return false;
        if (selectedPriceRange === "200+" && price < 200) return false;
      }

      // 5. Filtro por Voltagem
      if (selectedVoltage) {
        const hasVoltage =
          selectedVoltage === "127"
            ? /\b(127|110|127v|110v)\b/i.test(text)
            : /\b(220|220v)\b/i.test(text);
        if (!hasVoltage) return false;
      }

      return true;
    });
  }, [initialProducts, searchQuery, selectedBrand, selectedTags, selectedPriceRange, selectedVoltage]);

  const hasActiveFilters = Boolean(
    selectedBrand ||
    selectedTags.length > 0 ||
    searchQuery.trim() ||
    selectedPriceRange ||
    selectedVoltage
  );

  return {
    searchQuery,
    setSearchQuery,
    selectedBrand,
    setSelectedBrand,
    selectedTags,
    handleToggleTag,
    selectedPriceRange,
    setSelectedPriceRange,
    selectedVoltage,
    setSelectedVoltage,
    handleClearAllFilters,
    brandsWithCounts,
    filteredProducts,
    hasActiveFilters,
    totalCount: initialProducts.length,
    filteredCount: filteredProducts.length,
  };
}
