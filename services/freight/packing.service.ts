import { FreightCartItemInput, PackageDimensions } from '@/types/freight';

// Valores padrão se o produto não tiver dimensões cadastradas
const DEFAULT_WEIGHT_GRAMS = 300; // 300g
const DEFAULT_LENGTH_CM = 16;     // 16cm
const DEFAULT_WIDTH_CM = 11;      // 11cm
const DEFAULT_HEIGHT_CM = 4;      // 4cm

// Limites mínimos aceitos pelos Correios
const MIN_CORREIOS_LENGTH = 15;
const MIN_CORREIOS_WIDTH = 10;
const MIN_CORREIOS_HEIGHT = 1;
const MIN_SUM_DIMENSIONS = 26; // C + L + A >= 26

/**
 * Serviço de empacotamento e cubagem para múltiplos itens do carrinho.
 * Calcula o peso somado e projeta uma caixa virtual mínima que comporta todos os itens.
 */
export class PackagePackingService {
  /**
   * Calcula as dimensões e peso consolidados a partir da lista de itens do carrinho.
   */
  public static calculateCartPackage(items: FreightCartItemInput[]): PackageDimensions {
    if (!items || items.length === 0) {
      return {
        weightInGrams: DEFAULT_WEIGHT_GRAMS,
        lengthCm: DEFAULT_LENGTH_CM,
        widthCm: DEFAULT_WIDTH_CM,
        heightCm: DEFAULT_HEIGHT_CM,
      };
    }

    let totalWeight = 0;
    let totalVolumeCm3 = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let totalStackedHeight = 0;

    for (const item of items) {
      const quantity = Math.max(1, Math.floor(item.quantity || 1));
      const weight = (item.weightInGrams && item.weightInGrams > 0 ? item.weightInGrams : DEFAULT_WEIGHT_GRAMS) * quantity;
      const length = item.lengthCm && item.lengthCm > 0 ? item.lengthCm : DEFAULT_LENGTH_CM;
      const width = item.widthCm && item.widthCm > 0 ? item.widthCm : DEFAULT_WIDTH_CM;
      const height = item.heightCm && item.heightCm > 0 ? item.heightCm : DEFAULT_HEIGHT_CM;

      totalWeight += weight;
      totalVolumeCm3 += (length * width * height) * quantity;

      if (length > maxLength) maxLength = length;
      if (width > maxWidth) maxWidth = width;
      totalStackedHeight += height * quantity;
    }

    // Estimativa de dimensões cúbicas ajustadas
    // Raiz cúbica do volume total para garantir proporção equilibrada se a altura empilhada for desproporcional
    const cubicDimension = Math.ceil(Math.cbrt(totalVolumeCm3));

    let finalLength = Math.max(maxLength, cubicDimension, MIN_CORREIOS_LENGTH);
    let finalWidth = Math.max(maxWidth, cubicDimension, MIN_CORREIOS_WIDTH);
    let finalHeight = Math.max(Math.min(totalStackedHeight, cubicDimension * 1.5), MIN_CORREIOS_HEIGHT);

    // Ajuste fino para a soma mínima exigida pelos Correios (C + L + A >= 26)
    if (finalLength + finalWidth + finalHeight < MIN_SUM_DIMENSIONS) {
      finalLength = Math.max(finalLength, 16);
      finalWidth = Math.max(finalWidth, 11);
      finalHeight = Math.max(finalHeight, 4);
    }

    // Limites máximos dos Correios para evitar recusa de cotação
    finalLength = Math.min(finalLength, 100);
    finalWidth = Math.min(finalWidth, 100);
    finalHeight = Math.min(finalHeight, 100);

    return {
      weightInGrams: Math.max(totalWeight, 50), // Mínimo 50g
      lengthCm: Math.ceil(finalLength),
      widthCm: Math.ceil(finalWidth),
      heightCm: Math.ceil(finalHeight),
    };
  }
}
