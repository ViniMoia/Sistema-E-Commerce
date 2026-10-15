import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';

beforeAll(async () => { await verifyTestDatabase(); });
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await prisma.$disconnect(); });

describe('maintenance guard on the actual Prisma client and disposable database', () => {
  it('rejects model, raw and transaction operations, then resumes with no writes', async () => {
    const before = await prisma.loja.count();
    vi.stubEnv('APP_MAINTENANCE_MODE', 'true');
    await expect(prisma.loja.count()).rejects.toThrow('APP_MAINTENANCE');
    // Even invalid ORM input must be stopped by middleware before reaching SQL.
    await expect(prisma.loja.create({ data: {} as never })).rejects.toThrow('APP_MAINTENANCE');
    await expect(prisma.session.deleteMany()).rejects.toThrow('APP_MAINTENANCE');
    await expect(prisma.$executeRaw`DELETE FROM "Session"`).rejects.toThrow('APP_MAINTENANCE');
    await expect(prisma.$queryRawUnsafe('DELETE FROM "Session" RETURNING id')).rejects.toThrow('APP_MAINTENANCE');
    await expect(prisma.$transaction(tx => tx.loja.count())).rejects.toThrow('APP_MAINTENANCE');
    await expect(prisma.$transaction([prisma.session.deleteMany()])).rejects.toThrow('APP_MAINTENANCE');
    vi.stubEnv('APP_MAINTENANCE_MODE', 'false');
    expect(await prisma.loja.count()).toBe(before);
  });
});
