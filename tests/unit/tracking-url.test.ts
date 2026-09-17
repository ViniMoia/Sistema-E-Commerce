import { describe, it, expect } from 'vitest';
import { getTrackingInfo } from '@/lib/freight/tracking-url';

describe('getTrackingInfo (lib/freight/tracking-url.ts)', () => {
  it('deve retornar null para código vazio ou nulo', () => {
    expect(getTrackingInfo(null)).toBeNull();
    expect(getTrackingInfo('')).toBeNull();
    expect(getTrackingInfo('   ')).toBeNull();
  });

  it('deve identificar código Correios no padrão SRO (Ex: AA123456789BR)', () => {
    const info = getTrackingInfo('AA123456789BR');
    expect(info).not.toBeNull();
    expect(info?.carrier).toBe('Correios');
    expect(info?.isCorreios).toBe(true);
    expect(info?.trackingUrl).toBe('https://rastreamento.correios.com.br/app/index.php?codigo=AA123456789BR');
  });

  it('deve identificar Correios se hint contiver SEDEX ou PAC', () => {
    const info = getTrackingInfo('12345678', 'Correios SEDEX');
    expect(info?.carrier).toBe('Correios');
    expect(info?.isCorreios).toBe(true);
    expect(info?.trackingUrl).toContain('rastreamento.correios.com.br');
  });

  it('deve identificar código J&T Express com prefixo JT ou 12-15 dígitos', () => {
    const infoJtPrefix = getTrackingInfo('JT123456789012');
    expect(infoJtPrefix?.carrier).toBe('J&T Express');
    expect(infoJtPrefix?.trackingUrl).toBe('https://www.jtexpress.com.br/trajectoryQuery?bills=JT123456789012');

    const infoJtDigits = getTrackingInfo('123456789012');
    expect(infoJtDigits?.carrier).toBe('J&T Express');
  });

  it('deve identificar Loggi se hint ou código indicar Loggi', () => {
    const info = getTrackingInfo('LOG123456', 'Loggi Express');
    expect(info?.carrier).toBe('Loggi');
    expect(info?.trackingUrl).toBe('https://www.loggi.com/rastreador/LOG123456');
  });

  it('deve fornecer URL de busca fallback para transportadoras genéricas', () => {
    const info = getTrackingInfo('XYZ98765', 'Azul Cargo');
    expect(info?.carrier).toBe('Azul Cargo');
    expect(info?.trackingUrl).toContain('google.com/search');
  });
});
