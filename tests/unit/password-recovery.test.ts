import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requestPasswordReset, resetPassword, AuthError } from '@/services/auth.service';
import { digestPasswordResetToken } from '@/lib/auth/password-reset-token';
import { POST as forgotPasswordRoute } from '@/app/api/auth/forgot-password/route';
import { POST as resetPasswordRoute } from '@/app/api/auth/reset-password/route';
import { DevEmailService, ResendEmailService, setEmailService } from '@/lib/email';
import * as tenant from '@/lib/tenant';
import type { Prisma } from '@prisma/client';

const queryText = (query: TemplateStringsArray | Prisma.Sql) =>
  'strings' in query ? query.strings.join('') : query.join('');

vi.mock('@/lib/prisma', () => ({ default: {
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  session: { deleteMany: vi.fn() }, $queryRaw: vi.fn(),
  $transaction: vi.fn(async callback => callback(prisma)),
} }));
vi.mock('@/lib/tenant', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/tenant')>(), getLojaFromHeaders: vi.fn(),
}));
const token = 'a'.repeat(64);
const data = { token, newPassword: 'NovaSenhaSegura#2026', lojaID: 'loja-1' };

describe('WF-10: recuperação de senha e e-mail', () => {
  let devEmailService: DevEmailService;
  beforeEach(() => {
    vi.clearAllMocks();
    devEmailService = new DevEmailService(); setEmailService(devEmailService);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'usr-123' }]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'usr-123' }] as never);
    vi.mocked(tenant.getLojaFromHeaders).mockResolvedValue({ id: 'loja-1', name: 'Continental' } as never);
  });
  it('envia bearer de 256 bits e persiste somente seu digest, com prazo no relógio do banco', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'usr-123', name: 'Carlos',
      email: 'carlos@example.invalid', status: 'ACTIVE', lojaID: 'loja-1', loja: { name: 'Continental' } } as never);
    expect(await requestPasswordReset({ email: ' CARLOS@EXAMPLE.INVALID ', lojaID: 'loja-1', originUrl: 'https://loja.example' })).toEqual({ success: true });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email_lojaID: { email: 'carlos@example.invalid', lojaID: 'loja-1' } }, include: { loja: true } });
    const html = devEmailService.getLastEmail()!.options.html;
    const bearer = html.match(/token=([a-f0-9]{64})/)![1];
    const sql = vi.mocked(prisma.$queryRaw).mock.calls[1];
    expect(sql.slice(1)).toContain(digestPasswordResetToken(bearer));
    expect(sql.slice(1)).not.toContain(bearer);
    expect(queryText(sql[0])).toContain("clock_timestamp() + interval '1 hour'");
    expect(html).not.toContain(digestPasswordResetToken(bearer));
  });
  it.each([null, { id: 'blocked', status: 'BLOCKED' }])('conta ausente/bloqueada retorna sucesso uniforme sem escrita ou envio', async user => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    expect(await requestPasswordReset({ email: 'missing@example.invalid', lojaID: 'loja-1' })).toEqual({ success: true });
    expect(prisma.$queryRaw).not.toHaveBeenCalled(); expect(devEmailService.sentEmails).toHaveLength(0);
  });
  it('bloqueio após a leitura impede emissão e envio', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'usr-123', status: 'ACTIVE' } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: 'usr-123' }]).mockResolvedValueOnce([]);
    expect(await requestPasswordReset({ email: 'c@example.invalid', lojaID: 'loja-1' })).toEqual({ success: true });
    expect(devEmailService.sentEmails).toHaveLength(0);
  });
  it('consome por predicado definitivo e só depois revoga sessões', async () => {
    expect(await resetPassword(data)).toMatchObject({ success: true });
    const sql = vi.mocked(prisma.$queryRaw).mock.calls[1];
    expect(queryText(sql[0])).toContain('"resetTokenExpires" > clock_timestamp()');
    expect(sql.slice(1)).toContain(digestPasswordResetToken(token));
    expect(sql.slice(1)).toContain('loja-1');
    expect(await bcrypt.compare(data.newPassword, String(sql[1]))).toBe(true);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'usr-123' } });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lojaID: 'loja-1', status: 'ACTIVE' }), take: 2 }));
  });
  it.each([[[]], [[{ id: 'a' }, { id: 'b' }]]])('resultado ausente/ambíguo falha antes de calcular/gravar a senha', async users => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce(users as never);
    await expect(resetPassword(data)).rejects.toThrow(AuthError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('token substituído/consumido/expirado na escrita não revoga sessões', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: 'usr-123' }]).mockResolvedValueOnce([]);
    await expect(resetPassword(data)).rejects.toThrow('Solicite um novo link');
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['token-legado', 'h1:' + token, token + ' '])('não aceita formato antigo, digest ou token alterado', async invalid => {
    await expect(resetPassword({ ...data, token: invalid })).rejects.toThrow(AuthError);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
  it('rejeita senha curta', async () => {
    await expect(resetPassword({ ...data, newPassword: '12345' })).rejects.toThrow(AuthError);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
  const request = (path: string, body: unknown, ip: string) => new Request('http://localhost/api/auth/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  it('rota forgot mantém resposta genérica', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const response = await forgotPasswordRoute(request('forgot-password', { email: 'c@example.invalid' }, '203.0.113.195'));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true });
  });
  it('rota forgot rejeita e-mail inválido', async () => {
    expect((await forgotPasswordRoute(request('forgot-password', { email: 'inválido' }, '203.0.113.196'))).status).toBe(422);
  });
  it('rota reset retorna erro genérico para token ausente', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);
    const response = await resetPasswordRoute(request('reset-password', { token, password: data.newPassword }, '203.0.113.197'));
    expect(response.status).toBe(400); expect((await response.json()).error).toContain('Solicite um novo link');
  });
  it('rota reset usa tenant resolvido pelo servidor', async () => {
    const response = await resetPasswordRoute(request('reset-password', { token, password: data.newPassword, lojaID: 'attacker-store' }, '203.0.113.198'));
    expect(response.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lojaID: 'loja-1' }) }));
  });
  it('rota reset sem tenant recusa a operação', async () => {
    vi.mocked(tenant.getLojaFromHeaders).mockResolvedValueOnce(null);
    expect((await resetPasswordRoute(request('reset-password', { token, password: data.newPassword }, '203.0.113.199'))).status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  describe("5. Testes de Infraestrutura: ResendEmailService", () => {
    it("deve retornar aviso seguro e não travar se RESEND_API_KEY não estiver configurada", async () => {
      const resendService = new ResendEmailService("", "teste@loja.com");
      const result = await resendService.sendEmail({
        to: "destinatario@teste.com",
        subject: "Teste",
        html: "<p>Olá</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("RESEND_API_KEY não configurada");
    });

    it("deve efetuar POST com Bearer token para https://api.resend.com/emails", async () => {
      const globalFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-resend-abc-123" }),
      });
      global.fetch = globalFetch;

      const resendService = new ResendEmailService("re_teste_key_12345", "noreply@continental.com");
      const result = await resendService.sendEmail({
        to: "cliente@teste.com",
        subject: "Redefinir Senha",
        html: "<p>Link</p>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-resend-abc-123");
      expect(globalFetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer re_teste_key_12345",
          }),
        })
      );
    });
  });
});
