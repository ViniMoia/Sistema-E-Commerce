export interface TrackingInfo {
  carrier: string;
  trackingCode: string;
  trackingUrl: string | null;
  isCorreios: boolean;
}

const CORREIOS_REGEX = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
const JT_REGEX = /^(JT[0-9A-Z]+|[0-9]{12,15})$/;

/**
 * Identifica a transportadora e gera o link direto de rastreamento oficial.
 */
export function getTrackingInfo(
  rawCode?: string | null,
  carrierHint?: string | null
): TrackingInfo | null {
  if (!rawCode) return null;

  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const hint = (carrierHint || '').toLowerCase();

  // 1. Correios: Padrão oficial SRO brasileiro (Ex: AA123456789BR)
  if (CORREIOS_REGEX.test(code) || hint.includes('correios') || hint.includes('sedex') || hint.includes('pac')) {
    return {
      carrier: 'Correios',
      trackingCode: code,
      trackingUrl: `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(code)}`,
      isCorreios: true,
    };
  }

  // 2. J&T Express: Começa com JT ou 12-15 dígitos numéricos
  if (JT_REGEX.test(code) || hint.includes('j&t') || hint.includes('jt express')) {
    return {
      carrier: 'J&T Express',
      trackingCode: code,
      trackingUrl: `https://www.jtexpress.com.br/trajectoryQuery?bills=${encodeURIComponent(code)}`,
      isCorreios: false,
    };
  }

  // 3. Loggi
  if (hint.includes('loggi') || code.startsWith('LOG')) {
    return {
      carrier: 'Loggi',
      trackingCode: code,
      trackingUrl: `https://www.loggi.com/rastreador/${encodeURIComponent(code)}`,
      isCorreios: false,
    };
  }

  // 4. Fallback com busca direta
  const carrierName = carrierHint ? carrierHint.trim() : 'Transportadora';
  return {
    carrier: carrierName,
    trackingCode: code,
    trackingUrl: `https://www.google.com/search?q=${encodeURIComponent(`rastreamento ${carrierName} ${code}`)}`,
    isCorreios: false,
  };
}
