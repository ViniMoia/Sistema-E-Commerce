"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { BrandSummary } from "@/components/catalog/BrandHoverFlyout";
import { useRouter } from "next/navigation";
import {
  buildCatalogQueryString,
  parseCatalogSearchParams,
  type CatalogFilterState,
} from "@/lib/catalog-query";

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

export const DEFAULT_PAGE_SIZE = 12;

export interface UseProductFiltersOptions {
  initialProducts: FilterableProduct[];
  initialBrands?: BrandSummary[];
  enableUrlSync?: boolean;
  pageSize?: number;
  initialFilters?: CatalogFilterState;
  serverPagination?: {
    totalCount: number;
    filteredCount: number;
    currentPage: number;
    pageSize: number;
  };
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
  handleClearAllFilters: () => void;
  brandsWithCounts: BrandSummary[];
  filteredProducts: FilterableProduct[];
  paginatedProducts: FilterableProduct[];
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
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

export const BRAND_REGEX: Record<string, RegExp> = {
  autoamerica:
    /\b(AUTOAMERICA|AUTO AMERICA|AUTO ESPELHAMENTO|TRIPLE PASTE|HIGH SHINE|FOAM GLOSS|GOLD DUSTER|FAST CUT|AMERICA)\b/i,
  cadillac:
    /\b(CADILLAC|CADMIX|MONSTER CARNAUBA|BLACK MAGIC|HARD WAX|IRONLAC|ROX|MOTORLAC)\b/i,
  easytech:
    /\b(EASYTECH|EASY TECH|INSIGNIA|PLASTI COAT|QUARTZ 9H|FLOAT|ZAP|MELT|PLURI|BACTRON|BACTRAN)\b/i,
  ipc:
    /\b(IPC|ECOCLEAN|CARPET|LAVADORA DE ESTOFADOS|PW C22P|SANITIZADORA)\b/i,
  karcher:
    /\b(KARCHER|KÄRCHER|HD 585|K2|K3|K4|K5)\b/i,
  kers:
    /\b(KERS|POLITRIZ KERS|RED SHINE|PWR|NANO HÍBRIDA)\b/i,
  lincoln:
    /\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN|BRAZUCA|BOINA DE LÃ|MEGA POLIDOR|SUPER POLIDOR|DUPLA FACE|HI-GLOSS|LISTRAS VERDES)\b/i,
  meguiars:
    /\b(MEGUIAR|MEGUIARS|MEGUIAR\'S|GOLD CLASS|QUICK DETAILER MEGUIAR|ULTIMATE COMP)\b/i,
  nasiol:
    /\b(NASIOL|ZR53|METALCOAT)\b/i,
  nobrecar:
    /\b(NOBRECAR|NOBRE CAR|S7 CLEANER|S-7|X-CAM|OFF LEATHER|TOP FINISH|ULTRA LUSTRO)\b/i,
  protelim:
    /\b(PROTELIM|PROT CAR|MAGIC FLUID|PROTWASH|OXICLENE)\b/i,
  sandet:
    /\b(SANDET|METALSIL|SANVO)\b/i,
  "sigma-tools":
    /\b(SIGMA TOOLS|SIGMA|SGT|SGT-|ROTO ORBITAL SGT|PNEUMATICA)\b/i,
  soft99:
    /\b(SOFT99|SOFT 99|GLACO|FUSSO|KING OF GLOSS|DARK & BLACK|KIWAMI|IRON TERMINATOR|REIN HADA|TIRE BLACK)\b/i,
  sonax:
    /\b(SONAX|PROFILINE|CERAMIC SPRAY)\b/i,
  vonixx:
    /\b(VONIXX|ROOTZ|SINTRA|BLEND|NATIVE|DELET|ALUMAX|PRISMA|PRIZM|V-PLASTIC|V-LIGHT|V-PAINT|V-ENERGY|VERONA|V-FLOC|V-ECO|VEXUS|REVOX|CITRON|CARNAUBA EXPRESS|VINTEX|MAKKER|ACIDUS)\b/i,
  wap:
    /\b(WAP)\b/i,
  zacs:
    /\b(ZACS|D-CLEAN|D-RET|DISOLV)\b/i,
};

/**
 * Utilitário seguro para extração de parâmetros de filtros e paginação a partir da URL.
 * Trata tanto query params padrão (?marca=...) quanto params acoplados ao hash (#catalogo?marca=...).
 */
function extractFiltersFromLocation(): CatalogFilterState {
  if (typeof window === "undefined") {
    return { brand: null, tags: [], search: "", priceRange: null, page: 1 };
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

  return parseCatalogSearchParams(searchParams);
}

/**
 * Hook de domínio responsável exclusivamente pela lógica de filtragem,
 * contadores de marcas, busca textual, paginação e sincronização bidirecional com a URL (SRP & Deep Linking).
 */
export function useProductFilters({
  initialProducts,
  initialBrands = [],
  enableUrlSync = true,
  pageSize: customPageSize,
  initialFilters,
  serverPagination,
}: UseProductFiltersOptions): UseProductFiltersReturn {
  const router = useRouter();
  const pageSize = serverPagination?.pageSize ??
    (customPageSize && customPageSize > 0 ? customPageSize : DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState(initialFilters?.search ?? "");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(initialFilters?.brand ?? null);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilters?.tags ?? []);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(
    initialFilters?.priceRange ?? null
  );
  const [currentPage, setCurrentPage] = useState<number>(
    initialFilters?.page ?? serverPagination?.currentPage ?? 1
  );
  const isHydratedRef = useRef(false);

  // ─── 1. Deep Linking: Leitura Inicial dos Parâmetros da URL na Montagem ──────
  useEffect(() => {
    if (typeof window === "undefined" || !enableUrlSync) return;

    if (initialFilters) {
      isHydratedRef.current = true;
      return;
    }

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
    if (initial.priceRange) {
      setSelectedPriceRange(initial.priceRange);
    }
    if (initial.page > 1) {
      setCurrentPage(initial.page);
    }

    isHydratedRef.current = true;
  }, [enableUrlSync, initialFilters]);

  useEffect(() => {
    if (!initialFilters) return;
    setSelectedBrand(initialFilters.brand);
    setSelectedTags(initialFilters.tags);
    setSearchQuery(initialFilters.search);
    setSelectedPriceRange(initialFilters.priceRange);
    setCurrentPage(initialFilters.page);
  }, [
    initialFilters?.brand,
    initialFilters?.search,
    initialFilters?.priceRange,
    initialFilters?.page,
    initialFilters?.tags.join(","),
  ]);

  // ─── 2. Sincronização Reativa Bidirecional: Estado -> URL (replaceState) ─────
  useEffect(() => {
    if (typeof window === "undefined" || !enableUrlSync || !isHydratedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const queryString = buildCatalogQueryString({
        brand: selectedBrand,
        tags: selectedTags,
        search: searchQuery,
        priceRange: selectedPriceRange,
        page: currentPage,
      });
      const currentHash = window.location.hash.split("?")[0] || "#catalogo";
      const pathname = window.location.pathname;

      const newUrl = queryString
        ? `${pathname}?${queryString}${currentHash}`
        : `${pathname}${currentHash}`;

      const currentFullUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (currentFullUrl !== newUrl) {
        if (serverPagination) {
          router.replace(newUrl, { scroll: false });
        } else {
          window.history.replaceState(null, "", newUrl);
        }
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [
    selectedBrand,
    selectedTags,
    searchQuery,
    selectedPriceRange,
    currentPage,
    enableUrlSync,
    router,
    serverPagination,
  ]);

  // ─── 3. Suporte ao Histórico do Navegador (Botões Voltar/Avançar) ───────────
  useEffect(() => {
    if (typeof window === "undefined" || !enableUrlSync) return;

    const handlePopState = () => {
      const updated = extractFiltersFromLocation();
      setSelectedBrand(updated.brand);
      setSelectedTags(updated.tags);
      setSearchQuery(updated.search);
      setSelectedPriceRange(updated.priceRange);
      setCurrentPage(updated.page);
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
    setSearchQuery("");
    setCurrentPage(1);
  }, []);

  // ─── 5. Reset Automático da Página ao Alterar Filtros (SRP) ──────────────────
  const isFilterMountRef = useRef(true);
  useEffect(() => {
    if (isFilterMountRef.current) {
      isFilterMountRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchQuery, selectedBrand, selectedTags, selectedPriceRange]);

  // ─── 5. Contagem dinâmica e em tempo real por marca para o Flyout ────────────
  const brandsWithCounts = useMemo(() => {
    if (serverPagination) return initialBrands;
    return initialBrands.map((b) => {
      const count = initialProducts.filter((p) => {
        const text = `${p.name} ${p.description || ""}`;
        return p.brandSlug === b.slug || BRAND_REGEX[b.slug]?.test(text);
      }).length;
      return { ...b, productCount: count > 0 ? count : b.productCount };
    });
  }, [initialBrands, initialProducts, serverPagination]);

  // ─── 6. Cálculo derivado dos produtos filtrados ──────────────────────────────
  const filteredProducts = useMemo(() => {
    if (serverPagination) return initialProducts;
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

      return true;
    });
  }, [initialProducts, searchQuery, selectedBrand, selectedTags, selectedPriceRange, serverPagination]);

  const hasActiveFilters = Boolean(
    selectedBrand ||
    selectedTags.length > 0 ||
    searchQuery.trim() ||
    selectedPriceRange
  );

  // ─── 7. Paginação Segura com Bounds Clamping (12 produtos por página) ─────────
  const effectiveFilteredCount = serverPagination?.filteredCount ?? filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(effectiveFilteredCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, Math.floor(Number(currentPage) || 1)), totalPages);

  const paginatedProducts = useMemo(() => {
    if (serverPagination) return initialProducts;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, initialProducts, safeCurrentPage, pageSize, serverPagination]);

  const startIndex = effectiveFilteredCount > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(safeCurrentPage * pageSize, effectiveFilteredCount);

  const handleSetPage = useCallback(
    (page: number) => {
      const target = Math.floor(Number(page) || 1);
      setCurrentPage(Math.min(Math.max(1, target), totalPages));
    },
    [totalPages]
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
    handleClearAllFilters,
    brandsWithCounts,
    filteredProducts,
    paginatedProducts,
    currentPage: safeCurrentPage,
    setCurrentPage: handleSetPage,
    totalPages,
    pageSize,
    startIndex,
    endIndex,
    hasActiveFilters,
    totalCount: serverPagination?.totalCount ?? initialProducts.length,
    filteredCount: effectiveFilteredCount,
  };
}
