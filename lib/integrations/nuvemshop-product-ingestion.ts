import { z } from 'zod';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { CommerceLocks } from '@/lib/commerce/locks';
import { logger } from '@/lib/logger';
import {
  defaultNuvemshopProductReader,
  type NuvemshopProductReaderCaller,
} from './nuvemshop-stock-sync';

const CLOUDINARY_FALLBACK = 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1789777720/images__teste_aspirador_1_geqkhm.jpg';

const remoteId = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().trim().min(1),
]).transform(String);

const localizedString = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]).transform(val => {
  if (typeof val === 'string') return val.trim();
  if (!val || typeof val !== 'object') return '';
  return (val.pt || Object.values(val)[0] || '').trim();
});

const localizedOptional = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]).nullable().optional().transform(val => {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') return (val.pt || Object.values(val)[0] || '').trim();
  return '';
});

export const nuvemshopCanonicalProductSchema = z.object({
  id: remoteId,
  name: localizedString,
  description: localizedOptional,
  price: z.union([z.number(), z.string()]).nullable().optional(),
  promotional_price: z.union([z.number(), z.string()]).nullable().optional(),
  attributes: z.array(z.record(z.string(), z.string())).default([]),
  published: z.boolean().default(true),
  visibility: z.enum(['visible', 'unlisted', 'hidden']).default('visible'),
  images: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional(),
    src: z.string().url().or(z.string()),
    position: z.number().int().optional(),
  })).default([]),
  categories: z.array(z.object({
    id: remoteId,
    name: localizedString,
  })).default([]),
  variants: z.array(z.object({
    id: remoteId,
    product_id: remoteId.optional(),
    sku: z.string().nullable().optional(),
    barcode: z.string().nullable().optional(),
    price: z.union([z.number(), z.string()]).nullable().optional(),
    promotional_price: z.union([z.number(), z.string()]).nullable().optional(),
    stock: z.number().int().nullable().optional(),
    stock_management: z.boolean().default(true),
    weight: z.union([z.number(), z.string()]).nullable().optional(),
    depth: z.union([z.number(), z.string()]).nullable().optional(),
    width: z.union([z.number(), z.string()]).nullable().optional(),
    height: z.union([z.number(), z.string()]).nullable().optional(),
    values: z.array(localizedString).default([]),
  })).min(1),
});

export type NuvemshopCanonicalProduct = z.infer<typeof nuvemshopCanonicalProductSchema>;

/**
 * Sanitizes HTML to strip dangerous tags (script, iframe, on* handlers)
 * while preserving safe formatting tags.
 */
export function sanitizeHtmlDescription(html: string): string {
  if (!html) return '';
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  clean = clean.replace(/ on\w+="[^"]*"/gi, '');
  clean = clean.replace(/ on\w+='[^']*'/gi, '');
  return clean.trim();
}

export interface FreightDimensionsResult {
  weightInGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  isSpecialFreight: boolean;
  shippingMode: 'AUTOMATIC' | 'WHATSAPP_ONLY';
}

/**
 * 3-Tier Freight & Dimension Calculator:
 * Tier 1: Regex parse from name and description.
 * Tier 2: Nuvemshop raw weight conversion (kg -> grams) & meter to cm scale normalization.
 * Tier 3: Strict clamp to Correios official minimums (300g, 16x11x4 cm) to protect authority.ts.
 */
export function calculateFreightDimensions(
  name: string,
  description: string,
  rawWeightKg?: number | string | null,
  rawDepth?: number | string | null,
  rawWidth?: number | string | null,
  rawHeight?: number | string | null
): FreightDimensionsResult {
  let detectedWeightGrams: number | null = null;

  // Tier 1: Regex parser in name and description
  const regex = /(?:peso|capacidade|conteúdo|conteudo)?\s*(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|g|grama|gramas|l|litro|litros|ml)\b/i;
  const match = (name + ' ' + description).match(regex);
  if (match) {
    const val = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    if (unit.startsWith('kg') || unit.startsWith('kilo') || unit.startsWith('l') || unit.startsWith('litro')) {
      detectedWeightGrams = Math.round(val * 1000);
    } else if (unit === 'g' || unit.startsWith('grama') || unit === 'ml') {
      detectedWeightGrams = Math.round(val);
    }
  }

  // Tier 2: Nuvemshop rawWeight (in kg)
  if (!detectedWeightGrams && rawWeightKg !== null && rawWeightKg !== undefined) {
    const num = parseFloat(String(rawWeightKg).replace(',', '.'));
    if (Number.isFinite(num) && num > 0) {
      detectedWeightGrams = Math.round(num * 1000);
    }
  }

  // Parse dimensions (handling meters vs centimeters)
  const parseDimension = (raw: number | string | null | undefined, fallback: number): number => {
    if (raw === null || raw === undefined) return fallback;
    const num = parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return fallback;
    // If < 1.0 (e.g. 0.16), lojista entered meters -> convert to cm (* 100)
    if (num < 1.0) {
      return Math.max(fallback, Math.round(num * 100));
    }
    return Math.max(fallback, Math.round(num));
  };

  // Tier 3: Official Correios min clamps
  const weightInGrams = Math.max(300, detectedWeightGrams ?? 300);
  const lengthCm = parseDimension(rawDepth, 16);
  const widthCm = parseDimension(rawWidth, 11);
  const heightCm = parseDimension(rawHeight, 4);

  // Check if exceeds Correios max limit (30kg or sum > 200cm)
  const isSpecialFreight = weightInGrams > 30000 || (lengthCm + widthCm + heightCm) > 200;

  // Classify shippingMode:
  const rawMeasurementsPresent = (
    rawWeightKg !== null && rawWeightKg !== undefined && Number(String(rawWeightKg).replace(',', '.')) > 0 &&
    rawDepth !== null && rawDepth !== undefined && Number(String(rawDepth).replace(',', '.')) > 0 &&
    rawWidth !== null && rawWidth !== undefined && Number(String(rawWidth).replace(',', '.')) > 0 &&
    rawHeight !== null && rawHeight !== undefined && Number(String(rawHeight).replace(',', '.')) > 0
  );
  const hasRegexMatch = Boolean(match);
  const shippingMode: 'AUTOMATIC' | 'WHATSAPP_ONLY' = (rawMeasurementsPresent || hasRegexMatch) ? 'AUTOMATIC' : 'WHATSAPP_ONLY';

  return {
    weightInGrams,
    lengthCm,
    widthCm,
    heightCm,
    isSpecialFreight,
    shippingMode,
  };
}

const tenantAdminCache = new Map<string, { userId: string; expiresAt: number }>();

export async function getTenantAdminId(tx: Prisma.TransactionClient, lojaID: string): Promise<string> {
  const now = Date.now();
  const cached = tenantAdminCache.get(lojaID);
  if (cached && cached.expiresAt > now) {
    return cached.userId;
  }

  const admin = await tx.user.findFirst({
    where: {
      lojaID,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!admin) {
    const anyUser = await tx.user.findFirst({
      where: { lojaID, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!anyUser) throw new Error('TENANT_ACTIVE_ADMIN_NOT_FOUND');
    tenantAdminCache.set(lojaID, { userId: anyUser.id, expiresAt: now + 300000 });
    return anyUser.id;
  }

  tenantAdminCache.set(lojaID, { userId: admin.id, expiresAt: now + 300000 });
  return admin.id;
}

export async function resolveStoreTenant(
  tx: Prisma.TransactionClient,
  storeId: string,
  configuredStoreId?: string
): Promise<{ id: string; nuvemshopStoreId: string | null }> {
  const matched = await tx.loja.findFirst({
    where: { nuvemshopStoreId: storeId },
    select: { id: true, nuvemshopStoreId: true },
  });
  if (matched) return matched;

  const activeLojas = await tx.loja.findMany({
    take: 2,
    select: { id: true, nuvemshopStoreId: true },
  });

  if (activeLojas.length === 1) {
    const loja = activeLojas[0];
    if (!loja.nuvemshopStoreId) {
      await tx.loja.update({
        where: { id: loja.id },
        data: { nuvemshopStoreId: storeId },
      });
    }
    return { id: loja.id, nuvemshopStoreId: storeId };
  }

  if (configuredStoreId && storeId === configuredStoreId && activeLojas.length > 0) {
    return activeLojas[0];
  }

  throw new Error(`TENANT_NOT_RESOLVED_FOR_STORE:${storeId}`);
}

export async function retireProductCascade(
  tx: Prisma.TransactionClient,
  remoteProductId: string
): Promise<{ status: 'RETIRED' | 'NOT_FOUND'; productId?: string }> {
  const product = await tx.product.findFirst({
    where: { nuvemshopProductId: remoteProductId },
    include: { productVariants: true },
  });

  if (!product) {
    return { status: 'NOT_FOUND' };
  }

  const now = new Date();
  const locks = new CommerceLocks(tx);
  await locks.acquire('product', [product.id]);

  const variantIds = product.productVariants.map(v => v.id);
  if (variantIds.length > 0) {
    await locks.acquire('variant', variantIds);
    await tx.productVariants.updateMany({
      where: { ProductID: product.id },
      data: {
        retiredAt: now,
        stock: 0,
        inventoryVersion: { increment: 1 },
      },
    });
  }

  await tx.product.update({
    where: { id: product.id },
    data: {
      retiredAt: now,
      stock: 0,
      catalogVersion: { increment: 1 },
    },
  });

  await tx.inventoryReservation.deleteMany({
    where: {
      productId: product.id,
      status: 'RESERVED',
    },
  });

  return { status: 'RETIRED', productId: product.id };
}

export async function reconcileCategoriesAndTags(
  tx: Prisma.TransactionClient,
  productId: string,
  lojaID: string,
  remoteCategories: Array<{ id?: string; name?: string }>,
  isSpecialFreight: boolean,
  isQuarantine: boolean
): Promise<string[]> {
  const tagsToSet = new Set<string>();

  if (isSpecialFreight) tagsToSet.add('_FRETE_ESPECIAL_');
  if (isQuarantine) tagsToSet.add('_QUARENTENA_OPERACIONAL_');

  const activeCategoryTagIds: string[] = [];

  for (const cat of remoteCategories) {
    const rawName = (cat.name || '').trim();
    if (!rawName) continue;
    const slug = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80);

    let categoryTag = await tx.categoryTag.findFirst({
      where: { lojaID, slug },
    });
    if (!categoryTag) {
      categoryTag = await tx.categoryTag.create({
        data: {
          lojaID,
          name: rawName.slice(0, 80),
          slug,
          group: 'GERAL',
        },
      });
    }

    activeCategoryTagIds.push(categoryTag.id);

    await tx.productCategoryTag.upsert({
      where: {
        productID_categoryTagID: {
          productID: productId,
          categoryTagID: categoryTag.id,
        },
      },
      create: {
        productID: productId,
        categoryTagID: categoryTag.id,
      },
      update: {},
    });

    tagsToSet.add(rawName.toLowerCase());
    tagsToSet.add(slug);
  }

  if (activeCategoryTagIds.length > 0) {
    await tx.productCategoryTag.deleteMany({
      where: {
        productID: productId,
        categoryTagID: { notIn: activeCategoryTagIds },
      },
    });
  }

  const finalTags = Array.from(tagsToSet);
  await tx.product.update({
    where: { id: productId },
    data: { tagsSearchCache: finalTags },
  });

  return finalTags;
}

export interface IngestProductPayload {
  storeId: string;
  productId: string;
  event: 'product/created' | 'product/updated' | 'product/deleted' | string;
}

export interface IngestProductOptions {
  caller?: NuvemshopProductReaderCaller;
  expectedStoreId?: string;
}

export interface IngestProductResult {
  status: 'INGESTED' | 'UPDATED' | 'QUARANTINE' | 'RETIRED' | 'SKIPPED' | 'NOT_FOUND' | 'ERROR';
  productId?: string;
  reason?: string;
  isQuarantine?: boolean;
}

/**
 * Main ingress function executing durable, idempotent Nuvemshop product ingestion.
 */
export async function ingestProductFromNuvemshop(
  payload: IngestProductPayload,
  options: IngestProductOptions = {}
): Promise<IngestProductResult> {
  const caller = options.caller ?? defaultNuvemshopProductReader;
  const configuredStoreId = options.expectedStoreId ?? process.env.NUVEMSHOP_STORE_ID;
  const accessToken = process.env.NUVEMSHOP_ACCESS_TOKEN;
  const userAgent = process.env.NUVEMSHOP_USER_AGENT;

  // 1. Handle deletion cascade immediately
  if (payload.event === 'product/deleted') {
    return await prisma.$transaction(async tx => {
      const retireResult = await retireProductCascade(tx, payload.productId);
      return {
        status: retireResult.status,
        productId: retireResult.productId,
      };
    });
  }

  if (!configuredStoreId || !accessToken) {
    return { status: 'SKIPPED', reason: 'NUVEMSHOP_CREDENTIALS_MISSING' };
  }

  // 2. Fetch remote canonical product outside transaction
  const remoteResponse = await caller.getProduct(
    payload.storeId || configuredStoreId,
    accessToken,
    payload.productId,
    userAgent
  );

  if (!remoteResponse.success || !remoteResponse.data) {
    logger.warn('Falha na leitura canônica de produto Nuvemshop.', {
      action: 'NUVEMSHOP_CANONICAL_PRODUCT_READ_FAILED',
      productId: payload.productId,
      status: remoteResponse.status,
      error: remoteResponse.error,
    });
    return {
      status: 'ERROR',
      reason: remoteResponse.error || `HTTP_${remoteResponse.status ?? 500}`,
    };
  }

  const parsed = nuvemshopCanonicalProductSchema.safeParse(remoteResponse.data);
  if (!parsed.success) {
    logger.error('Payload canônico inválido da Nuvemshop.', new Error('INVALID_CANONICAL_SCHEMA'), {
      action: 'NUVEMSHOP_SCHEMA_VALIDATION_FAILED',
      productId: payload.productId,
    });
    return { status: 'ERROR', reason: 'INVALID_CANONICAL_SCHEMA' };
  }

  const remote = parsed.data;

  // 3. Transactional Ingestion Phase
  return await prisma.$transaction(async tx => {
    const tenant = await resolveStoreTenant(tx, payload.storeId, configuredStoreId);
    const lojaID = tenant.id;
    const adminUserId = await getTenantAdminId(tx, lojaID);

    // Calculate Freight Dimensions
    const firstVariant = remote.variants[0];
    const freight = calculateFreightDimensions(
      remote.name,
      remote.description,
      firstVariant?.weight,
      firstVariant?.depth,
      firstVariant?.width,
      firstVariant?.height
    );

    // Check Status Gate & Quarantine
    const productBasePrice = parseFloat(String(remote.promotional_price || remote.price || 0));
    const priceCandidates = remote.variants
      .map(v => parseFloat(String(v.promotional_price || v.price || productBasePrice || 0)))
      .filter(p => Number.isFinite(p) && p > 0);
    const lowestPrice = priceCandidates.length > 0 ? Math.min(...priceCandidates) : (Number.isFinite(productBasePrice) && productBasePrice > 0 ? productBasePrice : 0);

    const isQuarantine =
      lowestPrice <= 0 ||
      remote.name.length < 2 ||
      remote.visibility !== 'visible' ||
      !remote.published;

    const safeDescription = sanitizeHtmlDescription(remote.description);
    const imageUrl = remote.images.length > 0 ? remote.images[0].src : CLOUDINARY_FALLBACK;
    const galleryUrls = remote.images.slice(1).map(img => img.src);

    // Default stockBuffer = 1 for omnichannel protection, 0 if in quarantine
    const stockBuffer = isQuarantine ? 0 : 1;

    // Check if Product already exists by nuvemshopProductId
    let product = await tx.product.findFirst({
      where: { nuvemshopProductId: remote.id, lojaID },
      include: { productVariants: true },
    });

    const isNew = !product;

    if (!product) {
      // Create new Product
      product = await tx.product.create({
        data: {
          name: remote.name,
          description: safeDescription,
          price: new Prisma.Decimal(lowestPrice.toFixed(2)),
          stock: 0, // will be updated from variants
          stockBuffer,
          sku: firstVariant?.sku || null,
          nuvemshopProductId: remote.id,
          imageUrl,
          galleryUrls,
          weightInGrams: freight.weightInGrams,
          lengthCm: freight.lengthCm,
          widthCm: freight.widthCm,
          heightCm: freight.heightCm,
          shippingMode: freight.shippingMode,
          lojaID,
          userID: adminUserId,
          retiredAt: null,
        },
        include: { productVariants: true },
      });
    } else {
      // Re-activate ("un-retire") if retired, update attributes
      product = await tx.product.update({
        where: { id: product.id },
        data: {
          name: remote.name,
          description: safeDescription,
          price: new Prisma.Decimal(lowestPrice.toFixed(2)),
          stockBuffer,
          sku: firstVariant?.sku || product.sku,
          imageUrl,
          galleryUrls,
          weightInGrams: freight.weightInGrams,
          lengthCm: freight.lengthCm,
          widthCm: freight.widthCm,
          heightCm: freight.heightCm,
          shippingMode: freight.shippingMode,
          retiredAt: null, // Un-retire
          catalogVersion: { increment: 1 },
        },
        include: { productVariants: true },
      });
    }

    const locks = new CommerceLocks(tx);
    await locks.acquire('product', [product.id]);

    // Handle Variants Reconcilation
    const remoteHasGrade = remote.variants.length > 1 || remote.attributes.length > 0;
    const existingVariants = product.productVariants;

    let aggregateStock = 0;

    if (!remoteHasGrade) {
      // Phase A: Single variant without grade
      const vRemote = remote.variants[0];
      const stockVal = isQuarantine ? 0 : (vRemote.stock ?? 0);
      aggregateStock = stockVal;

      const existingNeutral = existingVariants.find(
        v => v.size === 'Único' && v.color === 'Padrão'
      );

      if (existingNeutral) {
        await tx.productVariants.update({
          where: { id: existingNeutral.id },
          data: {
            stock: stockVal,
            sku: vRemote.sku || existingNeutral.sku,
            nuvemshopVariantId: vRemote.id,
            retiredAt: null,
            inventoryVersion: { increment: 1 },
          },
        });
      } else {
        await tx.productVariants.create({
          data: {
            ProductID: product.id,
            size: 'Único',
            color: 'Padrão',
            stock: stockVal,
            sku: vRemote.sku || null,
            nuvemshopVariantId: vRemote.id,
            retiredAt: null,
          },
        });
      }
    } else {
      // Phase B: Multi-variant Grade
      // If there was a legacy neutral variant, retire it and clean its nuvemshopVariantId
      const legacyNeutral = existingVariants.find(
        v => v.size === 'Único' && v.color === 'Padrão' && !v.retiredAt
      );
      if (legacyNeutral) {
        await tx.productVariants.update({
          where: { id: legacyNeutral.id },
          data: {
            retiredAt: new Date(),
            stock: 0,
            nuvemshopVariantId: null, // Clear remote ID to prevent collisions
            inventoryVersion: { increment: 1 },
          },
        });
      }

      for (const vRemote of remote.variants) {
        const stockVal = isQuarantine ? 0 : (vRemote.stock ?? 0);
        aggregateStock += stockVal;

        const sizeVal = vRemote.values[0] || 'Único';
        const colorVal = vRemote.values[1] || 'Padrão';

        const matchedVariant = existingVariants.find(
          v => v.nuvemshopVariantId === vRemote.id ||
            (!v.retiredAt && v.size === sizeVal && v.color === colorVal)
        );

        if (matchedVariant) {
          await tx.productVariants.update({
            where: { id: matchedVariant.id },
            data: {
              size: sizeVal,
              color: colorVal,
              stock: stockVal,
              sku: vRemote.sku || matchedVariant.sku,
              nuvemshopVariantId: vRemote.id,
              retiredAt: null, // Un-retire if previously retired
              inventoryVersion: { increment: 1 },
            },
          });
        } else {
          await tx.productVariants.create({
            data: {
              ProductID: product.id,
              size: sizeVal,
              color: colorVal,
              stock: stockVal,
              sku: vRemote.sku || null,
              nuvemshopVariantId: vRemote.id,
              retiredAt: null,
            },
          });
        }
      }
    }

    // Update aggregate product stock
    await tx.product.update({
      where: { id: product.id },
      data: { stock: aggregateStock },
    });

    // Reconcile Categories and Tags
    await reconcileCategoriesAndTags(
      tx,
      product.id,
      lojaID,
      remote.categories,
      freight.isSpecialFreight,
      isQuarantine
    );

    return {
      status: isQuarantine ? 'QUARANTINE' : (isNew ? 'INGESTED' : 'UPDATED'),
      productId: product.id,
      isQuarantine,
    };
  });
}
