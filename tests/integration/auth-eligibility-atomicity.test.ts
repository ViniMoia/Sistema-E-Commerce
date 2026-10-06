import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { resetPassword, requestPasswordReset } from '@/services/auth.service';
import { digestPasswordResetToken } from '@/lib/auth/password-reset-token';
import { issueAuthenticatedSession } from '@/lib/auth/session-issuance';
import { changeUserEligibility, updateUserRole, updateUserStatus } from '@/services/user.service';
import { DevEmailService, setEmailService } from '@/lib/email';
import { patch, post } from '@/tests/helpers/request';

const realHash = bcrypt.hash.bind(bcrypt);
const gate = () => { let open!: () => void; const promise = new Promise<void>(resolve => { open = resolve; }); return { promise, open }; };
const oldPassword = 'FixtureAntiga#2026';
let oldHash: string;
beforeAll(async () => { await verifyTestDatabase(); oldHash = await realHash(oldPassword, 10); });
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const account = async (lojaID: string, role = 'CUSTOMER', status: 'ACTIVE' | 'BLOCKED' = 'ACTIVE') =>
  prisma.user.create({ data: { lojaID, role, status, name: 'Fixture', email: `${randomUUID()}@example.invalid`, password: oldHash } });
async function recovery() {
  const lojaID = await createFixtureStore(); const user = await account(lojaID); const token = randomBytes(32).toString('hex');
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: digestPasswordResetToken(token), resetTokenExpires: new Date(Date.now() + 60000) } });
  await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60000) } });
  return { user, lojaID, token, newPassword: 'FixtureNova#2026' };
}
async function admins() { const lojaID = await createFixtureStore(); return { lojaID, a: await account(lojaID, 'ADMIN'), b: await account(lojaID, 'ADMIN') }; }
const activeAdmins = (lojaID: string) => prisma.user.count({ where: { lojaID, role: 'ADMIN', status: 'ACTIVE' } });
const audit = (lojaID: string) => prisma.auditLog.count({ where: { entity: 'USER', metadata: { path: ['lojaID'], equals: lojaID } } });
async function waitForBlockedReset(minimum = 1) {
  for (let i = 0; i < 100; i++) {
    const rows = await prisma.$queryRaw<{ pid: number }[]>`SELECT pid FROM pg_stat_activity
      WHERE usename = current_user AND wait_event_type = 'Lock' AND query LIKE '%SELECT id FROM "User" WHERE id =%FOR UPDATE%'`;
    if (rows.length >= minimum) return rows.map(row => row.pid);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Conditional password write did not reach the row wait.');
}

describe('WF-10 / LA-028: conditional recovery in real PostgreSQL', () => {
  it('two different passwords sharing one token have exactly one winner; final password matches it', async () => {
    const fixture = await recovery(); const ready = gate(); const release = gate(); let hashes = 0;
    const locked = gate(); const unlock = gate();
    const holder = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${fixture.user.id} FOR UPDATE`;
      locked.open(); await unlock.promise;
    }, { timeout: 10000 });
    await locked.promise;
    vi.spyOn(bcrypt, 'hash').mockImplementation((async (password: string, salt: number) => {
      const hash = await realHash(password, salt); if (++hashes === 2) ready.open(); await release.promise; return hash;
    }) as typeof bcrypt.hash);
    const passwords = ['VencedoraA#2026', 'VencedoraB#2026'];
    const pending = passwords.map(newPassword => resetPassword({ ...fixture, newPassword }));
    const settled = Promise.allSettled(pending);
    try {
      await ready.promise; release.open();
      expect(new Set(await waitForBlockedReset(2)).size).toBe(2);
    } finally { release.open(); unlock.open(); }
    await holder;
    const results = await settled;
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const winner = results.findIndex(r => r.status === 'fulfilled');
    const final = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    expect(await bcrypt.compare(passwords[winner], final.password)).toBe(true);
    expect(await bcrypt.compare(passwords[1 - winner], final.password)).toBe(false);
    expect(final.resetToken).toBeNull(); expect(final.resetTokenExpires).toBeNull();
    expect(await prisma.session.count({ where: { userId: final.id } })).toBe(0);
  });
  it('reissue during bcrypt invalidates the old request and keeps only the new hashed bearer', async () => {
    const fixture = await recovery(); const ready = gate(); const release = gate();
    vi.spyOn(bcrypt, 'hash').mockImplementation((async (password: string, salt: number) => {
      const hash = await realHash(password, salt); ready.open(); await release.promise; return hash;
    }) as typeof bcrypt.hash);
    const pending = resetPassword(fixture); const result = Promise.allSettled([pending]);
    const mail = new DevEmailService(); setEmailService(mail);
    try {
      await ready.promise;
      await requestPasswordReset({ email: fixture.user.email, lojaID: fixture.lojaID, originUrl: 'https://fixture.example' });
    } finally { release.open(); }
    expect((await result)[0].status).toBe('rejected');
    const newToken = mail.getLastEmail()!.options.html.match(/token=([a-f0-9]{64})/)![1];
    const current = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    expect(current.password).toBe(oldHash); expect(current.resetToken).toBe(digestPasswordResetToken(newToken));
    expect(current.resetToken).not.toBe(newToken); expect(current.resetTokenExpires!.getTime() - Date.now()).toBeGreaterThan(3500000);
    await expect(resetPassword({ ...fixture, token: current.resetToken! })).rejects.toThrow('Solicite um novo link');
    vi.restoreAllMocks(); expect(await resetPassword({ ...fixture, token: newToken })).toMatchObject({ success: true });
  });
  it('expiration during an actual row wait is checked using the advancing database clock', async () => {
    const fixture = await recovery(); const locked = gate(); const release = gate();
    await prisma.$executeRaw`UPDATE "User" SET "resetTokenExpires" = clock_timestamp() + interval '2 seconds' WHERE id = ${fixture.user.id}`;
    const holder = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${fixture.user.id} FOR UPDATE`;
      locked.open(); await release.promise;
    }, { timeout: 10000 });
    await locked.promise;
    const pending = resetPassword(fixture); const result = Promise.allSettled([pending]);
    try {
      await waitForBlockedReset();
      // The holder never changes the tuple: no concurrent-UPDATE EPQ can save
      // a timestamp predicate evaluated before acquisition of the row lock.
      let expired = false;
      for (let i = 0; i < 60; i++) {
        const [row] = await prisma.$queryRaw<{ expired: boolean }[]>`SELECT "resetTokenExpires" <= clock_timestamp() AS expired FROM "User" WHERE id = ${fixture.user.id}`;
        if (row.expired) { expired = true; break; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      expect(expired).toBe(true);
    } finally { release.open(); }
    await holder;
    expect((await result)[0].status).toBe('rejected');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).password).toBe(oldHash);
    expect(await prisma.session.count({ where: { userId: fixture.user.id } })).toBe(1);
  });
  it('session deletion failure rolls back password and token consumption', async () => {
    const fixture = await recovery(); const suffix = randomUUID().replaceAll('-', '');
    const fn = `fail_reset_${suffix}`; const trigger = `fail_reset_${suffix}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD."userId" = '${fixture.user.id}' THEN RAISE EXCEPTION 'fixture session revoke failure'; END IF; RETURN OLD; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE DELETE ON "Session" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
    try { await expect(resetPassword(fixture)).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "Session"`); await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`); }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).toMatchObject({ password: oldHash, resetToken: digestPasswordResetToken(fixture.token) });
    expect(await prisma.session.count({ where: { userId: fixture.user.id } })).toBe(1);
    expect(await resetPassword(fixture)).toMatchObject({ success: true });
  });
  it('blocking during bcrypt cancels the pending reset and clears recovery/session credentials', async () => {
    const fixture = await recovery(); const admin = await account(fixture.lojaID, 'ADMIN');
    const ready = gate(); const release = gate();
    vi.spyOn(bcrypt, 'hash').mockImplementation((async (password: string, salt: number) => {
      const hash = await realHash(password, salt); ready.open(); await release.promise; return hash;
    }) as typeof bcrypt.hash);
    const pending = resetPassword(fixture); const result = Promise.allSettled([pending]);
    try { await ready.promise; await updateUserStatus(fixture.user.id, admin.id, 'BLOCKED', fixture.lojaID); }
    finally { release.open(); }
    expect((await result)[0].status).toBe('rejected');
    expect(await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).toMatchObject({ password: oldHash, status: 'BLOCKED', resetToken: null });
    expect(await prisma.session.count({ where: { userId: fixture.user.id } })).toBe(0);
  });
  it('legacy plaintext, wrong tenant, ambiguous digest and blocked user are refused without changing password', async () => {
    const fixture = await recovery();
    await expect(resetPassword({ ...fixture, lojaID: await createFixtureStore() })).rejects.toThrow();
    await prisma.user.update({ where: { id: fixture.user.id }, data: { resetToken: fixture.token } });
    await expect(resetPassword(fixture)).rejects.toThrow();
    await prisma.user.update({ where: { id: fixture.user.id }, data: { resetToken: digestPasswordResetToken(fixture.token) } });
    const duplicate = await account(fixture.lojaID);
    await prisma.user.update({ where: { id: duplicate.id }, data: { resetToken: digestPasswordResetToken(fixture.token), resetTokenExpires: new Date(Date.now() + 60000) } });
    await expect(resetPassword(fixture)).rejects.toThrow();
    await prisma.user.update({ where: { id: duplicate.id }, data: { resetToken: null } });
    await prisma.user.update({ where: { id: fixture.user.id }, data: { status: 'BLOCKED' } });
    await expect(resetPassword(fixture)).rejects.toThrow();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).password).toBe(oldHash);
  });
  it('an old-password login paused after verification cannot create a session after reset', async () => {
    const fixture = await recovery(); const ready = gate(); const release = gate(); const compare = bcrypt.compare.bind(bcrypt);
    vi.spyOn(bcrypt, 'compare').mockImplementation((async (password: string, hash: string) => {
      const valid = await compare(password, hash); ready.open(); await release.promise; return valid;
    }) as typeof bcrypt.compare);
    const pending = issueAuthenticatedSession({ userId: fixture.user.id, lojaID: fixture.lojaID, password: oldPassword });
    const result = Promise.allSettled([pending]);
    try { await ready.promise; await resetPassword(fixture); } finally { release.open(); }
    expect((await result)[0].status).toBe('rejected');
    expect(await prisma.session.count({ where: { userId: fixture.user.id } })).toBe(0);
    vi.restoreAllMocks(); expect(await issueAuthenticatedSession({ userId: fixture.user.id, lojaID: fixture.lojaID, password: fixture.newPassword })).toMatchObject({ userId: fixture.user.id });
  });
});

describe('WF-10 / LA-029: store lock and renewed administrator authorization', () => {
  it('crossed demotions have one winner and leave one ACTIVE administrator', async () => {
    const { lojaID, a, b } = await admins();
    const results = await Promise.allSettled([updateUserRole(b.id, a.id, 'CUSTOMER', lojaID), updateUserRole(a.id, b.id, 'CUSTOMER', lojaID)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await activeAdmins(lojaID)).toBe(1); expect(await audit(lojaID)).toBe(1);
  });
  it('block versus demotion is serialized and the actor losing eligibility cannot continue', async () => {
    const { lojaID, a, b } = await admins();
    const results = await Promise.allSettled([updateUserStatus(b.id, a.id, 'BLOCKED', lojaID), updateUserRole(a.id, b.id, 'CUSTOMER', lojaID)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await activeAdmins(lojaID)).toBe(1); expect(await audit(lojaID)).toBe(1);
  });
  it('blocked ADMIN rows do not authorize a change, and zero-admin legacy cannot self-promote', async () => {
    const lojaID = await createFixtureStore(); const blocked = await account(lojaID, 'ADMIN', 'BLOCKED'); const target = await account(lojaID);
    await expect(updateUserRole(target.id, blocked.id, 'ADMIN', lojaID)).rejects.toThrow('UNAUTHORIZED');
    await expect(updateUserRole(target.id, target.id, 'ADMIN', lojaID)).rejects.toThrow('FORBIDDEN');
    expect(await activeAdmins(lojaID)).toBe(0); expect(await audit(lojaID)).toBe(0);
  });
  it('self changes, another tenant, deletion and tenant transfer are fail-closed', async () => {
    const { lojaID, a, b } = await admins(); const foreign = await account(await createFixtureStore());
    await expect(updateUserRole(a.id, a.id, 'CUSTOMER', lojaID)).rejects.toThrow('CANNOT_CHANGE_OWN_ROLE');
    await expect(updateUserStatus(a.id, a.id, 'BLOCKED', lojaID)).rejects.toThrow('CANNOT_CHANGE_OWN_STATUS');
    await expect(updateUserRole(foreign.id, a.id, 'ADMIN', lojaID)).rejects.toThrow('USER_NOT_FOUND');
    await expect(updateUserRole(b.id, a.id, 'CUSTOMER', foreign.lojaID)).rejects.toThrow('FORBIDDEN');
    for (const kind of ['DELETE', 'TRANSFER']) await expect(changeUserEligibility(b.id, a.id, { kind } as never, lojaID)).rejects.toThrow('INVALID_ELIGIBILITY_CHANGE');
    expect(await activeAdmins(lojaID)).toBe(2); expect(await audit(lojaID)).toBe(0);
  });
  it('role/block and their session revocation/audit roll back together on audit failure', async () => {
    const { lojaID, a, b } = await admins(); const token = randomBytes(32).toString('hex');
    await prisma.user.update({ where: { id: b.id }, data: { resetToken: digestPasswordResetToken(token), resetTokenExpires: new Date(Date.now() + 60000) } });
    await prisma.session.create({ data: { userId: b.id, expiresAt: new Date(Date.now() + 60000) } });
    const name = `fail_admin_${randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "${name}" CHECK ("targetId" IS DISTINCT FROM '${b.id}')`);
    try {
      await expect(updateUserRole(b.id, a.id, 'CUSTOMER', lojaID)).rejects.toThrow();
      await expect(updateUserStatus(b.id, a.id, 'BLOCKED', lojaID)).rejects.toThrow();
    } finally { await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "${name}"`); }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', resetToken: digestPasswordResetToken(token) });
    expect(await prisma.session.count({ where: { userId: b.id } })).toBe(1); expect(await audit(lojaID)).toBe(0);
    await updateUserStatus(b.id, a.id, 'BLOCKED', lojaID);
    expect(await prisma.session.count({ where: { userId: b.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).resetToken).toBeNull();
    expect(await audit(lojaID)).toBe(1);
  });
  it('HTTP role route enforces the host tenant and does not expose password or token', async () => {
    const { lojaID, a, b } = await admins(); const shop = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
    const session = await prisma.session.create({ data: { userId: a.id, expiresAt: new Date(Date.now() + 60000) } });
    const headers = { Host: `${shop.slug}.plataforma.com`, Cookie: `session_id=${session.id}` };
    const other = await prisma.loja.findUniqueOrThrow({ where: { id: await createFixtureStore() } });
    expect((await patch(`/api/admin/users/${b.id}/role`, { role: 'CUSTOMER' }, { headers: { ...headers, Host: `${other.slug}.plataforma.com` } })).status).toBe(403);
    expect((await patch(`/api/admin/users/${b.id}/role`, { role: 'CUSTOMER', status: 'BLOCKED' }, { headers })).status).toBe(422);
    const result = await patch(`/api/admin/users/${b.id}/role`, { role: 'CUSTOMER' }, { headers });
    expect(result.status).toBe(200); expect(result.body).toMatchObject({ id: b.id, role: 'CUSTOMER' });
    expect(result.body).not.toHaveProperty('password'); expect(result.body).not.toHaveProperty('resetToken');
  });
  it('HTTP reset consumes only in the resolved tenant; replay is rejected', async () => {
    const fixture = await recovery(); const shop = await prisma.loja.findUniqueOrThrow({ where: { id: fixture.lojaID } });
    const other = await prisma.loja.findUniqueOrThrow({ where: { id: await createFixtureStore() } });
    const body = { token: fixture.token, password: fixture.newPassword, lojaID: fixture.lojaID };
    expect((await post('/api/auth/reset-password', body, { headers: { Host: `${other.slug}.plataforma.com` } })).status).toBe(400);
    const headers = { Host: `${shop.slug}.plataforma.com` };
    expect((await post('/api/auth/reset-password', body, { headers })).status).toBe(200);
    expect((await post('/api/auth/reset-password', body, { headers })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).resetToken).toBeNull();
  });
  it('HTTP login issues a real cookie only with the current password and hides credential hashes', async () => {
    const fixture = await recovery(); await resetPassword(fixture);
    const shop = await prisma.loja.findUniqueOrThrow({ where: { id: fixture.lojaID } });
    const headers = { Host: `${shop.slug}.plataforma.com` };
    expect((await post('/api/auth/login', { email: fixture.user.email, password: oldPassword }, { headers })).status).toBe(401);
    const response = await post('/api/auth/login', { email: fixture.user.email, password: fixture.newPassword }, { headers });
    expect(response.status).toBe(200); expect(response.headers?.['set-cookie']).toContain('session_id=');
    expect(response.body).not.toHaveProperty('user.password'); expect(response.body).not.toHaveProperty('user.resetToken');
    expect(await prisma.session.count({ where: { userId: fixture.user.id } })).toBe(1);
  });
});
