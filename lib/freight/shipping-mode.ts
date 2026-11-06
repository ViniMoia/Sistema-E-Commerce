/**
 * Módulo de Classificação e Contágio de Frete
 * Especificação: diversos/PLANEJAMENTO_AUTOMACAO/PLANO_PROTECAO_FRETE_E_MEDIDAS_WHATSAPP.md
 */

export type ShippingMode = 'AUTOMATIC' | 'WHATSAPP_ONLY';

export interface ProductDimensionsLike {
  name: string;
  description?: string | null;
  weightInGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  shippingMode?: string | null;
}

/**
 * Regex para resgate inteligente no nome e descrição (Tier 1).
 * Detecta expressões seguras como 5L, 1kg, 500ml, 20L, etc.
 */
export const FREIGHT_TIER1_REGEX =
  /(?:peso|capacidade|conteúdo|conteudo)?\s*(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|g|grama|gramas|l|litro|litros|ml)\b/i;

/**
 * Classifica um produto entre AUTOMATIC (cálculo por Correios/J&T)
 * ou WHATSAPP_ONLY (frete a combinar via WhatsApp para evitar prejuízo).
 */
export function classifyProductShippingMode(
  p: ProductDimensionsLike,
  options?: { ignoreSavedMode?: boolean }
): ShippingMode {
  // 1. Se já possui o valor explicitado no banco e não solicitou re-cálculo
  if (!options?.ignoreSavedMode) {
    if (p.shippingMode === 'WHATSAPP_ONLY') return 'WHATSAPP_ONLY';
    if (p.shippingMode === 'AUTOMATIC') return 'AUTOMATIC';
  }

  // 2. Verificar se possui dimensões reais cadastradas (não o puro fallback 300g e 16x11x4)
  const isFallbackDefault =
    p.weightInGrams === 300 &&
    p.lengthCm === 16 &&
    p.widthCm === 11 &&
    p.heightCm === 4;

  const hasGenuineMeasurements =
    !isFallbackDefault &&
    typeof p.weightInGrams === 'number' &&
    p.weightInGrams >= 50 &&
    typeof p.lengthCm === 'number' &&
    p.lengthCm >= 5 &&
    typeof p.widthCm === 'number' &&
    p.widthCm >= 5 &&
    typeof p.heightCm === 'number' &&
    p.heightCm >= 2;

  if (hasGenuineMeasurements) {
    return 'AUTOMATIC';
  }

  // 3. Tier 1: Resgate por Regex no nome e descrição
  const fullText = (p.name + ' ' + (p.description || '')).toLowerCase();
  if (FREIGHT_TIER1_REGEX.test(fullText)) {
    return 'AUTOMATIC';
  }

  // 4. Se não tem medidas reais nem resgate seguro, cai na proteção WhatsApp
  return 'WHATSAPP_ONLY';
}

/**
 * Regra de Contágio do Carrinho Misto:
 * Se ao menos 1 item do carrinho for WHATSAPP_ONLY, todo o carrinho é forçado
 * para WHATSAPP_ONLY (deliveryType = 'NONE', frete R$ 0,00 no pedido).
 */
export function resolveCartShippingMode(items: ProductDimensionsLike[]): ShippingMode {
  if (!items || items.length === 0) return 'AUTOMATIC';
  const hasWhatsAppOnly = items.some(item => classifyProductShippingMode(item) === 'WHATSAPP_ONLY');
  return hasWhatsAppOnly ? 'WHATSAPP_ONLY' : 'AUTOMATIC';
}

/**
 * Gera a mensagem pré-formatada e o link do WhatsApp para cotação de frete.
 */
export function buildWhatsAppFreightUrl(params: {
  phone: string;
  orderNumber: number | string;
  cep?: string | null;
  customerName?: string | null;
}): string {
  const cleanPhone = params.phone.replace(/\D/g, '');
  const greeting = params.customerName ? `Olá, sou ${params.customerName}!` : 'Olá!';
  const cepInfo = params.cep ? ` para o meu CEP [${params.cep}]` : '';
  const message = `${greeting} Acabei de concluir o pedido #${params.orderNumber} no site. Meus itens têm frete a combinar e gostaria de cotar o envio${cepInfo}.`;
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
