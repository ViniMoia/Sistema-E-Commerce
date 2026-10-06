import prisma from '@/lib/prisma';
import { Prisma, DeliveryType, type FreightQuote } from '@prisma/client';
import { z } from 'zod';
import { FreightOption, IFreightProvider } from '@/types/freight';
import { loadFreightAuthority, freightFingerprint, type FreightItems } from '@/lib/freight/authority';
import { resolveFreightDestination, destinationSchema, type FreightDestination } from '@/lib/freight/destination';
import { signFreightQuote, assertFreightSigningReady } from '@/lib/freight-quote';
import { CorreiosProvider } from './providers/correios.provider';
import { CustomTableProvider } from './providers/custom-table.provider';
import { PickupProvider } from './providers/pickup.provider';
import { NoneOptionProvider } from './providers/none.provider';
import { JtExpressProvider } from './providers/jt-express.provider';

export interface CalculateFreightParams {
  lojaID: string; ownerKey: string; destinationCep?: string; items: FreightItems; deliveryType?: DeliveryType;
}
const optionSchema = z.object({ providerId: z.string().min(1).max(32), serviceCode: z.string().min(1).max(120),
  serviceName: z.string().min(1).max(120), price: z.number().finite().min(0).max(99999999.99),
  deliveryTimeInDays: z.number().int().min(0).max(3650) }).passthrough();
type Calculation = { options: FreightOption[]; expiresAt: number };
const eligible = (provider: string, deliveryType: DeliveryType) => deliveryType === 'PICKUP' ? provider === 'STORE_PICKUP' :
  deliveryType === 'NONE' ? provider === 'NONE' : !['STORE_PICKUP', 'NONE'].includes(provider);
export const freightQuoteBinding = (row: FreightQuote) => freightFingerprint([
  row.id, row.lojaID, row.ownerKey, row.fingerprint, row.cartContentHash, row.destinationHash,
  row.configurationVersion, row.deliveryType, row.provider, row.serviceCode, row.serviceName,
  row.amount.toFixed(2), row.estimatedDays, row.expiresAt.getTime(), row.snapshot,
]);

export class FreightOrchestratorService {
  // Process-local optimization only. Every hit is gated by fresh persisted revisions.
  private readonly cache = new Map<string, Calculation>();
  constructor(private readonly providers: IFreightProvider[] = [new JtExpressProvider(), new CorreiosProvider(),
    new CustomTableProvider(), new PickupProvider(), new NoneOptionProvider()],
    private readonly destinationResolver: (cep: string) => Promise<FreightDestination> = resolveFreightDestination) {}

  async calculate(params: CalculateFreightParams) {
    assertFreightSigningReady();
    if (!/^(u:[a-zA-Z0-9_-]{1,128}|g:[a-f0-9]{64})$/.test(params.ownerKey)) throw new Error('FREIGHT_OWNER_REQUIRED');
    const deliveryType = params.deliveryType ?? 'DELIVERY';
    const destination = deliveryType === 'DELIVERY' ? destinationSchema.parse(await this.destinationResolver(params.destinationCep ?? '')) : null;
    const context = await prisma.$transaction(tx => loadFreightAuthority(tx, params.lojaID, params.items, destination));
    const key = 'freight-v2:' + context.fingerprint + ':' + deliveryType;
    const now = context.now.getTime();
    for (const [id, value] of this.cache) if (value.expiresAt <= now) this.cache.delete(id);
    let calculation = this.cache.get(key); let hadFailure = false;
    if (!calculation || calculation.expiresAt <= now) {
      const request = { lojaID: params.lojaID, originCep: context.loja.originCep?.replace(/\D/g, '') ?? '',
        destinationCep: destination?.cep ?? '', destination, packages: context.packages,
        cartTotal: Number(context.cartTotal), itemsCount: context.itemsCount, items: context.providerItems,
        storeSettings: { additionalDays: context.loja.additionalDays, enableCorreios: context.loja.enableCorreios,
          correiosContractCode: context.loja.correiosContractCode, correiosPassword: context.loja.correiosPassword,
          enablePickup: context.loja.enablePickup, enableNoFreight: context.loja.enableNoFreight } };
      const results = await Promise.all(this.providers.filter(p => eligible(p.id, deliveryType)).map(async provider => {
        try {
          if (!await provider.isAvailableForStore(params.lojaID, request.storeSettings)) return [];
          const options = await provider.calculateQuotes(request);
          return options.map(option => {
            optionSchema.parse(option);
            if (option.providerId !== provider.id || !eligible(option.providerId, deliveryType)) throw new Error('FREIGHT_PROVIDER_RESULT_INVALID');
            return option;
          });
        } catch { hadFailure = true; console.warn('[FREIGHT_PROVIDER_FAILURE]', provider.id); return []; }
      }));
      const options = results.flat().sort((a, b) => a.price - b.price || a.serviceCode.localeCompare(b.serviceCode));
      if (!options.length) throw new Error('FREIGHT_OPTIONS_UNAVAILABLE');
      calculation = { options, expiresAt: now + 30 * 60 * 1000 };
      if (!hadFailure) {
        if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, calculation);
      }
    }
    const computed = calculation;
    // Never sign/mint authority from a stale calculation. Recheck after remote
    // I/O, under the same revision/product locks used by acceptance.
    return prisma.$transaction(async tx => {
      const current = await loadFreightAuthority(tx, params.lojaID, params.items, destination);
      if (current.fingerprint !== context.fingerprint || computed.expiresAt <= current.now.getTime()) throw new Error('FREIGHT_REQUOTE_REQUIRED');
      const options = await Promise.all(computed.options.map(async option => {
        const amount = new Prisma.Decimal(option.price);
        if (!amount.equals(amount.toDecimalPlaces(2))) throw new Error('FREIGHT_PROVIDER_RESULT_INVALID');
        const row = await tx.freightQuote.create({ data: { lojaID: params.lojaID, ownerKey: params.ownerKey,
          cartContentHash: current.contentHash, destinationHash: current.destinationHash, fingerprint: current.fingerprint,
          configurationVersion: current.loja.configurationVersion, deliveryType, provider: option.providerId,
          serviceCode: option.serviceCode, serviceName: option.serviceName, amount, estimatedDays: option.deliveryTimeInDays,
          expiresAt: new Date(computed.expiresAt), snapshot: { schemaVersion: 2, destination, originCep: current.loja.originCep,
            declaredValue: current.cartTotal, packages: { ...current.packages } } } });
        return { ...option, freightQuoteId: row.id, freightQuoteToken: signFreightQuote({ quoteId: row.id,
          bindingHash: freightQuoteBinding(row), expiresAt: row.expiresAt.getTime() }), expiresAt: row.expiresAt.toISOString() };
      }));
      return { options, serverTime: current.now.toISOString(), merchandiseSubtotal: current.cartTotal, packageDetails: { weightInGrams: current.packages.weightInGrams,
        dimensions: [current.packages.lengthCm, current.packages.widthCm, current.packages.heightCm].join('x') + ' cm' } };
    });
  }
}
export const freightOrchestrator = new FreightOrchestratorService();
