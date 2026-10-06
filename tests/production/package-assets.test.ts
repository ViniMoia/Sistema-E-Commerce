import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { cleanupFixtureStores, createFixtureStore } from '@/tests/setup/fixture-scope';
import { productionOrigins, productionRequest } from '@/tests/helpers/production-request';

let headers: Record<string, string>;
beforeAll(async () => {
  productionOrigins(); await verifyTestDatabase(); const lojaID = await createFixtureStore();
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
  headers = { Host: loja.slug + '.plataforma.com' };
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

describe('WF-19: relocated package serves its public and compiled assets', () => {
  it('serves the source public SVG from both isolated instances', async () => {
    const expected = await readFile('public/brands/wap.svg', 'utf8');
    for (const instance of [0, 1] as const) {
      const response = await productionRequest(instance, 'GET', '/brands/wap.svg', undefined, headers);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/svg+xml');
      expect(response.body).toBe(expected);
    }
  });
  it('serves the compiled JavaScript referenced by an actual rendered login page', async () => {
    for (const instance of [0, 1] as const) {
      const page = await productionRequest(instance, 'GET', '/login', undefined, headers);
      expect(page.status).toBe(200); expect(typeof page.body).toBe('string');
      const script = String(page.body).match(/src="(\/_next\/static\/[^"<>]+\.js(?:\?[^"<>]*)?)"/);
      expect(script).not.toBeNull();
      const response = await productionRequest(instance, 'GET', script![1].replaceAll('&amp;', '&'), undefined, headers);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/javascript/);
      expect(String(response.body).length).toBeGreaterThan(100);
      expect(String(response.body).slice(0, 100)).not.toContain('<!DOCTYPE html');
    }
  });
});
