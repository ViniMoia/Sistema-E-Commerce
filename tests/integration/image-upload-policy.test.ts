import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { post, put } from '@/tests/helpers/request';

let fixture: Awaited<ReturnType<typeof createFulfillmentFixture>>;
let customerSession: string;
const reference = 'https://dcdn-us.mitiendanube.com/stores/001/products/photo-640-0.webp';
const options = (session?: string) => ({ headers: { Host: fixture.host, ...(session ? { Cookie: `session_id=${session}` } : {}) } });

beforeAll(async () => {
  await verifyTestDatabase();
  fixture = await createFulfillmentFixture();
  customerSession = (await prisma.session.create({ data: { userId: fixture.customer.id, expiresAt: new Date(Date.now() + 3600000) } })).id;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

describe('image policy on the isolated HTTP server and database', () => {
  it('rejects uploads from anonymous, customer and Admin without changing avatars or products', async () => {
    for (const session of [undefined, customerSession, fixture.session.id]) {
      const res = await post('/api/upload', { bucket: 'products', file: 'data:image/png;base64,aW1hZ2U=' }, options(session));
      expect(res.status).toBe(session ? 403 : 401);
      expect(res.body).toMatchObject({ success: false, code: session ? 'UPLOAD_NOT_ALLOWED' : 'UNAUTHORIZED' });
    }
    expect(await prisma.product.count({ where: { lojaID: fixture.lojaID } })).toBe(0);
    expect(await prisma.user.count({ where: { lojaID: fixture.lojaID, avatarImageUrl: { not: null } } })).toBe(0);
  });

  it('persists external references verbatim and rejects embedded images before database mutations', async () => {
    const input = { name: 'Produto com referência externa', description: 'Referência sintética de catálogo', price: 10,
      stock: 2, imageUrl: reference, galleryUrls: [reference], variants: [{ size: 'Único', color: 'Padrão', stock: 2 }] };
    const created = await post('/api/products', input, options(fixture.session.id));
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    const before = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(before).toMatchObject({ imageUrl: reference, galleryUrls: [reference] });
    const variantIds = await prisma.productVariants.findMany({ where: { ProductID: id }, select: { id: true } });
    for (const value of ['data:image/png;base64,aW1hZ2U=', 'blob:https://example.invalid/image']) {
      expect((await post('/api/products', { ...input, imageUrl: value }, options(fixture.session.id))).status).toBe(422);
      expect((await put(`/api/products/${id}`, { imageUrl: value }, options(fixture.session.id))).status).toBe(422);
      expect((await put(`/api/products/${id}`, { galleryUrls: [value] }, options(fixture.session.id))).status).toBe(422);
      expect((await put('/api/loja/settings', { coverImageUrl: value }, options(fixture.session.id))).status).toBe(422);
    }
    expect(await prisma.product.findUniqueOrThrow({ where: { id } })).toEqual(before);
    expect(await prisma.product.count({ where: { lojaID: fixture.lojaID } })).toBe(1);
    expect(await prisma.productVariants.findMany({ where: { ProductID: id }, select: { id: true } })).toEqual(variantIds);
    const next = reference.replace('640', '1024');
    expect((await put(`/api/products/${id}`, { imageUrl: next, galleryUrls: [reference, next] }, options(fixture.session.id))).status).toBe(200);
    expect(await prisma.product.findUniqueOrThrow({ where: { id } })).toMatchObject({ imageUrl: next, galleryUrls: [reference, next] });
  }, 60000);
});
