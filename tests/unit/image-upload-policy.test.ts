import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/prisma';
import { POST as upload } from '@/app/api/upload/route';
import { uploadAvatarAction } from '@/app/profile/actions';
import { POST as createProduct } from '@/app/api/products/route';
import { PUT as updateProduct } from '@/app/api/products/[id]/route';
import { PUT as updateSettings } from '@/app/api/loja/settings/route';
import * as products from '@/services/product.service';
import * as stores from '@/services/loja.service';
import { externalImageUrlSchema } from '@/lib/validators/image-url';
import { registerSchema } from '@/lib/validators/auth';
import { ProductImageUrl } from '@/components/admin/ProductImageUrl';
import { AvatarManager } from '@/app/profile/components/AvatarManager';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { user: { update: vi.fn() } } }));
vi.mock('@/lib/tenant', () => ({ getLojaFromHeaders: vi.fn() }));
vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: 'admin', lojaID: 'store', role: 'ADMIN' } })),
  requirePurchaseAdmin: vi.fn(async () => ({ user: { id: 'admin', lojaID: 'store', role: 'ADMIN' } })),
}));
vi.mock('@/services/product.service', () => ({ createProduct: vi.fn(), updateProduct: vi.fn() }));
vi.mock('@/services/loja.service', () => ({ updateLojaSettings: vi.fn(), getLojaSettings: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network call'); }));
  // Even a mistakenly enabled flag and configured Storage must not permit writes.
  vi.stubEnv('ENABLE_DIRECT_UPLOAD', 'true');
  vi.stubEnv('SUPABASE_URL', 'https://storage.example.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const reference = 'https://dcdn-us.mitiendanube.com/stores/001/products/photo-640-0.webp';
const request = (body: unknown) => new Request('http://localhost/api/products', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const product = { name: 'Produto externo', description: 'Imagem importada por referência', price: 49.9,
  imageUrl: reference, galleryUrls: [reference], stock: 1, variants: [{ size: 'Único', color: 'Padrão', stock: 1 }] };

describe('permanent image upload denial', () => {
  for (const environment of ['test', 'development', 'production'] as const) {
    it.each(['ADMIN', 'CUSTOMER', null])('denies %s in ' + environment + ' before reading a file or writing', async role => {
      vi.stubEnv('NODE_ENV', environment);
      vi.mocked(getCurrentUser).mockResolvedValue(role ? { id: 'actor', lojaID: 'store', role } as never : null);
      const form = new FormData();
      form.append('file', new File(['synthetic'], 'photo.png', { type: 'image/png' }));
      const req = new Request('http://localhost/api/upload', { method: 'POST', body: form });
      const parse = vi.spyOn(req, 'formData');
      const read = vi.spyOn(form, 'get');
      const res = await upload(req);
      expect(res.status).toBe(role ? 403 : 401);
      expect(await res.json()).toMatchObject({ success: false, code: role ? 'UPLOAD_NOT_ALLOWED' : 'UNAUTHORIZED' });
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      expect(await uploadAvatarAction(form)).toMatchObject({ success: false, code: role ? 'UPLOAD_NOT_ALLOWED' : 'UNAUTHORIZED' });
      expect(parse).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
      expect(createClient).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  }
});

describe('external image references', () => {
  it.each(['data:image/png;base64,aW1hZ2U=', 'blob:https://example.com/image', 'file:///tmp/photo.png',
    'javascript:alert(1)', 'ftp://example.com/photo.png', 'https://user:password@example.com/photo.png'])
  ('rejects embedded/non-web images in product, gallery, avatar and store cover: %s', async value => {
    expect(externalImageUrlSchema.safeParse(value).success).toBe(false);
    for (const field of [{ imageUrl: value }, { galleryUrls: [value] }]) {
      expect((await createProduct(request({ ...product, ...field }))).status).toBe(422);
      expect((await updateProduct(request(field), { params: Promise.resolve({ id: 'product' }) })).status).toBe(422);
    }
    expect((await updateSettings(request({ coverImageUrl: value }))).status).toBe(422);
    expect(registerSchema.safeParse({ name: 'Cliente', email: 'fixture@example.invalid', password: 'secret123', avatarImageUrl: value }).success).toBe(false);
    expect(products.createProduct).not.toHaveBeenCalled();
    expect(products.updateProduct).not.toHaveBeenCalled();
    expect(stores.updateLojaSettings).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves external URLs through product create/update without copying image bytes', async () => {
    vi.mocked(products.createProduct).mockResolvedValue({ id: 'product' } as never);
    vi.mocked(products.updateProduct).mockResolvedValue({ id: 'product' } as never);
    expect((await createProduct(request(product))).status).toBe(201);
    expect(products.createProduct).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: reference, galleryUrls: [reference] }));
    expect((await updateProduct(request({ imageUrl: reference, galleryUrls: [reference] }), { params: Promise.resolve({ id: 'product' }) })).status).toBe(200);
    expect(products.updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({ imageUrl: reference, galleryUrls: [reference] }), 'store', 'admin');
    expect(externalImageUrlSchema.parse('https://res.cloudinary.com/fixture/image/upload/photo.jpg')).toBe('https://res.cloudinary.com/fixture/image/upload/photo.jpg');
    expect(fetch).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('renders only a URL field and preview; profiles have no upload control', () => {
    const markup = renderToStaticMarkup(createElement(ProductImageUrl, { value: reference, onChange: vi.fn() }));
    expect(markup).toContain('type="url"');
    expect(markup).toContain(reference);
    expect(markup).not.toContain('type="file"');
    const invalid = renderToStaticMarkup(createElement(ProductImageUrl, { value: 'data:image/png;base64,aW1hZ2U=', onChange: vi.fn() }));
    expect(invalid).not.toContain('<img');
    const profile = renderToStaticMarkup(createElement(AvatarManager, { user: { id: 'actor', name: 'Cliente', role: 'CUSTOMER', email: 'fixture@example.invalid' } }));
    expect(profile).not.toContain('type="file"');
    expect(profile).not.toContain('<button');
  });
});
