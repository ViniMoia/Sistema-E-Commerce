import type { GetProductsFilters } from "@/services/product.service";

export interface CatalogFilterState {
  brand: string | null;
  tags: string[];
  search: string;
  priceRange: string | null;
  page: number;
}

const ALLOWED_PRICE_RANGES = new Set(["0-50", "50-100", "100-150", "150-200", "200+"]);

function firstParam(params: URLSearchParams, names: string[]): string | null {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

export function searchParamsToUrlSearchParams(
  input: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

export function parseCatalogSearchParams(params: URLSearchParams): CatalogFilterState {
  const rawTags = params.getAll("tags").concat(params.getAll("tag")).join(",");
  const tags = Array.from(
    new Set(
      rawTags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20)
    )
  );

  const rawPage = firstParam(params, ["pagina", "page"]);
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const rawPriceRange = firstParam(params, ["preco", "price", "priceRange"]);

  return {
    brand: firstParam(params, ["marca", "brand", "brandSlug"])?.toLowerCase() ?? null,
    tags,
    search: (firstParam(params, ["busca", "search", "q"]) ?? "").slice(0, 120),
    priceRange:
      rawPriceRange && ALLOWED_PRICE_RANGES.has(rawPriceRange) ? rawPriceRange : null,
    page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
  };
}

export function catalogStateToProductFilters(
  state: CatalogFilterState,
  lojaId: string,
  pageSize: number
): GetProductsFilters {
  const priceBounds: Record<string, { minPrice?: number; maxPrice?: number }> = {
    "0-50": { minPrice: 0, maxPrice: 50 },
    "50-100": { minPrice: 50, maxPrice: 100 },
    "100-150": { minPrice: 100, maxPrice: 150 },
    "150-200": { minPrice: 150, maxPrice: 200 },
    "200+": { minPrice: 200 },
  };

  return {
    lojaId,
    name: state.search || undefined,
    brandSlug: state.brand || undefined,
    tags: state.tags.length > 0 ? state.tags : undefined,
    page: state.page,
    limit: pageSize,
    sortBy: state.search ? "relevance" : "newest",
    ...(state.priceRange ? priceBounds[state.priceRange] : {}),
  };
}

export function buildCatalogQueryString(state: CatalogFilterState): string {
  const params = new URLSearchParams();
  if (state.brand) params.set("marca", state.brand);
  if (state.tags.length > 0) params.set("tags", state.tags.join(","));
  if (state.search.trim()) params.set("busca", state.search.trim());
  if (state.priceRange) params.set("preco", state.priceRange);
  if (state.page > 1) params.set("pagina", String(state.page));
  return params.toString();
}
