import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { signFreightQuote, verifyFreightQuote } from '@/lib/freight-quote';
import { resolveFreightDestination } from '@/lib/freight/destination';
import { PackagePackingService } from '@/services/freight/packing.service';
import { CorreiosProvider } from '@/services/freight/providers/correios.provider';
import type { FreightQuoteRequest } from '@/types/freight';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const payload = () => ({ quoteId: randomUUID(), bindingHash: 'a'.repeat(64), expiresAt: Date.now() + 60000 });
describe('WF-11: signed v2 contract and destination boundary', () => {
  it('roundtrips exact versioned payload; rejects tampering, extra segments, old version and oversized input', () => {
    const data = payload(); const token = signFreightQuote(data);
    expect(verifyFreightQuote(token)).toEqual({ ...data, version: 2 });
    for (const invalid of [token + '.extra', token + '.', token.slice(0, -5) + 'wrong', 'a'.repeat(2049), 'legacy.signature']) expect(() => verifyFreightQuote(invalid)).toThrow();
  });
  it('production cannot use the development secret as a fallback', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('FREIGHT_QUOTE_SECRET', '');
    expect(() => signFreightQuote(payload())).toThrow('FREIGHT_QUOTE_SECRET_MISSING');
  });
  it('resolves exact CEP/city/UF/IBGE from the server response with timeout/no-store', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ cep: '01001-000', uf: 'SP', localidade: 'São Paulo', ibge: '3550308' })));
    vi.stubGlobal('fetch', fetch);
    expect(await resolveFreightDestination('01001-000')).toEqual({ cep: '01001000', state: 'SP', city: 'São Paulo', municipalityCode: '3550308' });
    expect(fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/', expect.objectContaining({ cache: 'no-store', redirect: 'error' }));
  });
  it.each([{ erro: true }, { cep: '99999-999', uf: 'SP', localidade: 'São Paulo', ibge: '3550308' },
    { cep: '01001-000', uf: 'XX', localidade: 'São Paulo', ibge: '3550308' }])('invalid or mismatched geography cannot authorize a destination', async body => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))));
    await expect(resolveFreightDestination('01001000')).rejects.toThrow('FREIGHT_DESTINATION_UNAVAILABLE');
  });
  it('timeout/provider failure does not fabricate a city', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout'); }));
    await expect(resolveFreightDestination('01001000')).rejects.toThrow('FREIGHT_DESTINATION_UNAVAILABLE');
  });
  it('oversized package cannot be silently clamped into a supported size', () => {
    expect(() => PackagePackingService.calculateCartPackage([{ quantity: 1, lengthCm: 150, widthCm: 10, heightCm: 10, weightInGrams: 300 }])).toThrow('FREIGHT_PACKAGE_UNSUPPORTED');
  });
  const carrierRequest: FreightQuoteRequest = { lojaID: 'store', originCep: '67140615', destinationCep: '01001000',
    packages: { weightInGrams: 300, lengthCm: 16, widthCm: 11, heightCm: 4 }, cartTotal: 1000, itemsCount: 1 };
  it('Correios receives authoritative declared value and returns only a provider-confirmed rate', async () => {
    const fetch = vi.fn(async (_input: string | URL | Request) => new Response('<cServico><Codigo>04014</Codigo><Valor>25,00</Valor><PrazoEntrega>3</PrazoEntrega><Erro>0</Erro></cServico>'));
    vi.stubGlobal('fetch', fetch);
    expect((await new CorreiosProvider().calculateQuotes(carrierRequest))[0]).toMatchObject({ price: 25, serviceCode: '04014' });
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('nVlValorDeclarado')).toBe('1000.00');
  });
  it('Correios failure and invalid XML never return estimated fallback tariffs', async () => {
    for (const response of [new Response('', { status: 503 }), new Response('<invalid/>')]) {
      vi.stubGlobal('fetch', vi.fn(async () => response));
      await expect(new CorreiosProvider().calculateQuotes(carrierRequest)).rejects.toThrow('CORREIOS_OPTIONS_UNAVAILABLE');
    }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout'); }));
    await expect(new CorreiosProvider().calculateQuotes(carrierRequest)).rejects.toThrow('CORREIOS_UNAVAILABLE');
  });
});
