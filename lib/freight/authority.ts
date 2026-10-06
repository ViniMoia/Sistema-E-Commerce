import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { resolveCatalogVariant } from '@/lib/product-variants';
import { PackagePackingService } from '@/services/freight/packing.service';
import type { FreightDestination } from './destination';
import { destinationSchema } from './destination';
import { freightClientItemsSchema } from '@/lib/commerce/freight-contract';

export const freightItemsSchema = freightClientItemsSchema;
export type FreightItems = z.infer<typeof freightItemsSchema>;
export const freightFingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Protect revisions before products. Acceptance takes UPDATE product locks
 * upfront because inventory will mutate them later, avoiding lock upgrades. */
export async function loadFreightAuthority(tx: Prisma.TransactionClient, lojaID: string, items: FreightItems,
  destination: FreightDestination | null, accepting = false) {
  const input = freightItemsSchema.parse(items);
  if (destination) destinationSchema.parse(destination);
  const revision = await tx.$queryRaw<{ version: number }[]>`SELECT version FROM "FreightTariffRevision" WHERE id = 'JT_EXPRESS' FOR SHARE`;
  if (revision.length !== 1) throw new Error('FREIGHT_REVISION_MISSING');
  await tx.$queryRaw`SELECT id FROM "Loja" WHERE id = ${lojaID} FOR SHARE`;
  const loja = await tx.loja.findUniqueOrThrow({ where: { id: lojaID } });
  const ids = [...new Set(input.map(item => item.productId))].sort();
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) ORDER BY id COLLATE "C" ${Prisma.raw(accepting ? 'FOR UPDATE' : 'FOR SHARE')}`);
  const products = await tx.product.findMany({ where: { id: { in: ids }, lojaID }, include: { productVariants: true } });
  const map = new Map(products.map(product => [product.id, product]));
  const seen = new Set<string>(); const productQuantities = new Map<string, number>();
  const canonical = input.map(item => {
    const product = map.get(item.productId);
    if (!product || product.retiredAt) throw new Error('FREIGHT_PRODUCT_UNAVAILABLE');
    const variant = resolveCatalogVariant(item.variantId
      ? product.productVariants.filter(variant => variant.id === item.variantId) : product.productVariants);
    if (!variant || variant.retiredAt || variant.stock < item.quantity) throw new Error('FREIGHT_VARIANT_UNAVAILABLE');
    const key = `${product.id}:${variant.id}`;
    if (seen.has(key)) throw new Error('FREIGHT_DUPLICATE_ITEM'); seen.add(key);
    const quantity = (productQuantities.get(product.id) ?? 0) + item.quantity; productQuantities.set(product.id, quantity);
    if (product.stock < quantity) throw new Error('FREIGHT_PRODUCT_UNAVAILABLE');
    const dimension = (n: number | null, fallback: number) => n === null ? fallback : n;
    const result = { productId: product.id, variantId: variant.id, quantity: item.quantity, name: product.name,
      price: new Prisma.Decimal(product.price).toFixed(2), catalogVersion: product.catalogVersion,
      weightInGrams: dimension(product.weightInGrams, 300), lengthCm: dimension(product.lengthCm, 16),
      widthCm: dimension(product.widthCm, 11), heightCm: dimension(product.heightCm, 4) };
    if ([result.weightInGrams, result.lengthCm, result.widthCm, result.heightCm].some(n => !Number.isFinite(n) || n <= 0)) throw new Error('FREIGHT_DIMENSIONS_INVALID');
    return result;
  }).sort((a, b) => `${a.productId}:${a.variantId}` < `${b.productId}:${b.variantId}` ? -1 : 1);
  const providerItems = canonical.map(item => ({ ...item, price: Number(item.price) }));
  const packages = PackagePackingService.calculateCartPackage(providerItems);
  const cartTotal = canonical.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.price).times(item.quantity)), new Prisma.Decimal(0)).toFixed(2);
  const contentHash = freightFingerprint({ namespace: 'freight-v2', items: canonical, packages, cartTotal });
  const destinationHash = freightFingerprint(destination);
  const fingerprint = freightFingerprint({ namespace: 'freight-v2', contentHash, destinationHash, lojaID,
    origin: [loja.originCep, loja.originState, loja.originCity], configurationVersion: loja.configurationVersion,
    tariffVersion: revision[0].version });
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return { loja, providerItems, packages, cartTotal, itemsCount: canonical.reduce((sum, item) => sum + item.quantity, 0),
    contentHash, destinationHash, fingerprint, destination, now: clock.now };
}
