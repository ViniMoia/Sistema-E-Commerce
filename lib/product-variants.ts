export interface VariantInput {
  id?: string;
  size: string;
  color: string;
  stock: number;
}

export interface CatalogVariant extends VariantInput {
  id: string;
}

function normalizeTerm(term?: string | null): string {
  return (term ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isDefaultVariantTerm(term?: string | null): boolean {
  const normalized = normalizeTerm(term);
  return !normalized || ["unico", "padrao", "default"].includes(normalized);
}

export function normalizeVariantDimension(term: string): string {
  return isDefaultVariantTerm(term) ? "" : normalizeTerm(term);
}

export function canonicalizeVariant<T extends VariantInput>(variant: T): T {
  return {
    ...variant,
    size: isDefaultVariantTerm(variant.size) ? "Único" : variant.size.trim(),
    color: isDefaultVariantTerm(variant.color) ? "Padrão" : variant.color.trim(),
    stock: Math.max(0, variant.stock),
  };
}

export function getVariantCombinationKey(variant: Pick<VariantInput, "size" | "color">): string {
  return JSON.stringify([
    normalizeVariantDimension(variant.size),
    normalizeVariantDimension(variant.color),
  ]);
}

export function getVariantOptions(variants: readonly VariantInput[]) {
  const distinct = (dimension: "size" | "color") => {
    const values = new Map<string, string>();
    for (const variant of variants) {
      const canonical = canonicalizeVariant(variant);
      const key = normalizeVariantDimension(canonical[dimension]);
      if (!values.has(key)) values.set(key, canonical[dimension]);
    }
    return [...values.values()];
  };
  // Inclui a opção neutra quando ela coexistir com opções comerciais distintas.
  const sizes = distinct("size");
  const colors = distinct("color");
  const hasRealSizes = sizes.length > 1;
  const hasRealColors = colors.length > 1;
  return { sizes, colors, hasRealSizes, hasRealColors, hasRealVariants: hasRealSizes || hasRealColors };
}

export function matchesVariantTerm(value: string, selected: string): boolean {
  return normalizeVariantDimension(value) === normalizeVariantDimension(selected);
}

export function resolveCatalogVariant<T extends CatalogVariant>(
  variants: readonly T[],
  selectedSize: string | null = null,
  selectedColor: string | null = null,
): T | null {
  const { hasRealSizes, hasRealColors } = getVariantOptions(variants);
  if ((hasRealSizes && !selectedSize) || (hasRealColors && !selectedColor)) return null;
  return variants.find((variant) =>
    variant.stock > 0 &&
    (!hasRealSizes || matchesVariantTerm(variant.size, selectedSize!)) &&
    (!hasRealColors || matchesVariantTerm(variant.color, selectedColor!))
  ) ?? null;
}
