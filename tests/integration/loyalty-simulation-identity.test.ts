import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { get, post } from '@/tests/helpers/request';
import { simulatePointsRedemption, adjustPointsManually } from '@/services/loyalty.service';

let lojaID: string; let otherLojaID: string; let victimId: string; let userId: string;
let host: string; let otherHost: string; let cookie: string;
beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore(); otherLojaID = await createFixtureStore();
  const store = await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true } });
  const otherStore = await prisma.loja.update({ where: { id: otherLojaID }, data: { loyaltyEnabled: true } });
  host = `${store.slug}.plataforma.com`; otherHost = `${otherStore.slug}.plataforma.com`;
  const createUser = () => prisma.user.create({ data: { lojaID, name: 'Pessoa', email: `${randomUUID()}@example.invalid`, password: '' } });
  victimId = (await createUser()).id; userId = (await createUser()).id;
  await prisma.loyaltyWallet.create({ data: { lojaID, userID: victimId, balance: 9000 } });
  const session = await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + 60000) } });
  cookie = `session_id=${session.id}`;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const input = () => ({ lojaID, subtotal: 500, requestedPoints: 1000 });

describe('LA-032: simulação HTTP por identidade autorizada, somente leitura', () => {
  it('visitante não consulta carteira de ID declarado; resposta genérica não cria carteira', async () => {
    const before = await prisma.loyaltyWallet.count({ where: { lojaID } });
    expect((await post('/api/loyalty/simulate', { ...input(), userID: victimId }, { headers: { Host: host } })).status).toBe(403);
    const generic = await post('/api/loyalty/simulate', input(), { headers: { Host: host } });
    expect(generic.status).toBe(200);
    expect(generic.body).toMatchObject({ data: { eligible: false, pointsToRedeem: 0, projectedEarnedPoints: 250 } });
    expect((generic.body as { data: object }).data).not.toHaveProperty('walletBalance');
    expect(await prisma.loyaltyWallet.count({ where: { lojaID } })).toBe(before);
  });
  it('conta autenticada sem carteira recebe saldo zero sem persistência e não consulta outra pessoa', async () => {
    const before = await prisma.loyaltyWallet.count({ where: { lojaID } });
    const options = { headers: { Host: host, Cookie: cookie } };
    expect((await post('/api/loyalty/simulate', { ...input(), userID: victimId }, options)).status).toBe(403);
    const own = await post('/api/loyalty/simulate', input(), options);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ data: { eligible: false, walletBalance: 0, pointsToRedeem: 0 } });
    const summary = await get('/api/loyalty/wallet', options);
    expect(summary.status).toBe(200);
    expect(summary.body).toMatchObject({ data: { wallet: { balance: 0 } } });
    expect(await prisma.loyaltyWallet.count({ where: { lojaID } })).toBe(before);
  });
  it('domínio, payload e sessão precisam concordar sobre a loja; serviço também recusa conta externa', async () => {
    expect((await get('/api/loja/active', { headers: { Host: otherHost } })).body).toMatchObject({ id: otherLojaID });
    expect((await post('/api/loyalty/simulate', { ...input(), lojaID: otherLojaID }, { headers: { Host: host, Cookie: cookie } })).status).toBe(403);
    expect((await post('/api/loyalty/simulate', { ...input(), lojaID: otherLojaID }, { headers: { Host: otherHost, Cookie: cookie } })).status).toBe(403);
    expect((await get('/api/loyalty/wallet', { headers: { Host: otherHost, Cookie: cookie } })).status).toBe(403);
    await expect(simulatePointsRedemption({ ...input(), lojaID: otherLojaID, userID: userId })).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    expect(await prisma.loyaltyWallet.count({ where: { lojaID: otherLojaID } })).toBe(0);
  });
  it('retorna apenas o saldo da própria sessão e preserva saldo, versão e ledger', async () => {
    const admin = await prisma.user.create({ data: { lojaID, name: 'Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } });
    const { wallet } = await adjustPointsManually({ lojaID, userID: userId, points: 300, description: 'Crédito explícito para a fixture', adminUserId: admin.id, commandId: randomUUID() });
    const ledgerBefore = await prisma.loyaltyTransaction.count({ where: { lojaID } });
    const own = await post('/api/loyalty/simulate', { ...input(), userID: userId }, { headers: { Host: host, Cookie: cookie } });
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ data: { eligible: true, walletBalance: 300, pointsToRedeem: 300, discountValue: 15 } });
    expect(await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: wallet.id } })).toEqual(wallet);
    expect(await prisma.loyaltyTransaction.count({ where: { lojaID } })).toBe(ledgerBefore);
  });
  it('serviço recusa conta bloqueada antes de consultar ou criar carteira', async () => {
    await prisma.user.update({ where: { id: userId }, data: { status: 'BLOCKED' } });
    const before = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: userId } } });
    await expect(simulatePointsRedemption({ ...input(), userID: userId })).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    expect(await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
  });
});
