import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JtExpressProvider } from '@/services/freight/providers/jt-express.provider';
import prisma from '@/lib/prisma';
import type { FreightQuoteRequest } from '@/types/freight';
vi.mock('@/lib/prisma', () => ({ default: { jtExpressGeocom: { findFirst: vi.fn() }, jtExpressRate: { findFirst: vi.fn() } } }));
const provider = new JtExpressProvider();
const request = { originCep: '67140615', destinationCep: '01310100', cartTotal: 100,
  packages: { weightInGrams: 32000, lengthCm: 16, widthCm: 11, heightCm: 4 }, storeSettings: {} } as FreightQuoteRequest;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.jtExpressGeocom.findFirst).mockResolvedValue({ geocomCode: 'A', state: 'SP', isRiskZone: false, deliveryDays: 3 } as never);
});
describe('V-04: limites da tabela J&T', () => {
  it.each([null, 0, -1])('não oferece excesso de peso sem tarifa adicional positiva: %s', async additionalKgPrice => {
    vi.mocked(prisma.jtExpressRate.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce({ weightMin: 29, weightMax: 30, basePrice: 50, additionalKgPrice } as never);
    expect(await provider.calculateQuotes(request)).toEqual([]);
  });
  it('não usa a faixa máxima para preencher buraco da tabela', async () => {
    vi.mocked(prisma.jtExpressRate.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce({ weightMin: 29, weightMax: 30, basePrice: 50, additionalKgPrice: 5 } as never);
    expect(await provider.calculateQuotes({ ...request, packages: { ...request.packages, weightInGrams: 20000 } })).toEqual([]);
  });
  it('calcula excesso autorizado e seguro sem subcotação', async () => {
    vi.mocked(prisma.jtExpressRate.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce({ weightMin: 29, weightMax: 30, basePrice: 50, additionalKgPrice: 5 } as never);
    expect(await provider.calculateQuotes(request)).toMatchObject([{ price: 60.6, deliveryTimeInDays: 3 }]);
  });
  it('recusa outra origem antes de consultar tarifas', async () => {
    expect(await provider.calculateQuotes({ ...request, originCep: '01310100' })).toEqual([]);
    expect(prisma.jtExpressGeocom.findFirst).not.toHaveBeenCalled();
  });
});
