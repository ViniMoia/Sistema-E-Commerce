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
 * Identifica se um produto é pesado (>= 15kg), volumoso (soma > 120cm)
 * ou maquinário industrial que exige veículo próprio / prazo especial.
 */
export function isHeavyOrLargeProduct(p: ProductDimensionsLike): boolean {
  if (typeof p.weightInGrams === 'number' && p.weightInGrams >= 15000) return true;
  const sum = (p.lengthCm ?? 16) + (p.widthCm ?? 11) + (p.heightCm ?? 4);
  if (sum > 120) return true;
  const text = `${p.name} ${p.description || ''}`;
  return /\b(EXTRATORA|COMPRESSOR|LAVADORA|ASPIRADOR INDUSTRIAL|POLITRIZ|20L|20 LITROS|50L)\b/i.test(text);
}

/**
 * Classifica um produto entre AUTOMATIC (cálculo por Correios/J&T/Tabela)
 * ou WHATSAPP_ONLY.
 * O lojista determinou que todo produto sem medidas explícitas na SMB Store
 * recebe fallback padrão dos Correios (300g, 16x11x4 cm) e modo AUTOMATIC,
 * encerrando o fallback de WhatsApp para garantir cotação 100% online.
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

  // 2. Fallback seguro dos Correios: todos os produtos recebem cálculo automático
  return 'AUTOMATIC';
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
