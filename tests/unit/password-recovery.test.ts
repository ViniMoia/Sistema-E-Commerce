import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requestPasswordReset, resetPassword, AuthError } from "@/services/auth.service";
import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import { DevEmailService, ResendEmailService, setEmailService } from "@/lib/email";
import * as tenant from "@/lib/tenant";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    loja: {
      findFirst: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      return callback({
        user: {
          update: vi.fn(),
        },
        session: {
          deleteMany: vi.fn(),
        },
      });
    }),
  },
}));

vi.mock("@/lib/tenant", () => ({
  getLojaFromHeaders: vi.fn(),
}));

describe("Arquitetura de Recuperação de Senha & E-mails Transacionais (REV-005)", () => {
  let devEmailService: DevEmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    devEmailService = new DevEmailService();
    setEmailService(devEmailService);
  });

  describe("1. Testes de Serviço: requestPasswordReset", () => {
    it("deve gerar token criptográfico de 64 caracteres hex (256 bits) e enviar e-mail para usuário existente", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr-123",
        name: "Carlos Silva",
        email: "carlos@exemplo.com",
        status: "ACTIVE",
        lojaID: "loja-continental-1",
        loja: {
          id: "loja-continental-1",
          name: "Continental Estética",
        },
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const result = await requestPasswordReset({
        email: "  CARLOS@EXEMPLO.COM ",
        lojaID: "loja-continental-1",
        originUrl: "https://continentalestetica.com.br",
      });

      expect(result.success).toBe(true);

      // Valida normalização de e-mail e chave multi-tenant
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          email_lojaID: {
            email: "carlos@exemplo.com",
            lojaID: "loja-continental-1",
          },
        },
        include: { loja: true },
      });

      // Valida persistência atômica do token e expiração
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: "usr-123" });
      expect(updateCall.data.resetToken).toBeDefined();
      expect(typeof updateCall.data.resetToken).toBe("string");
      expect((updateCall.data.resetToken as string).length).toBe(64); // 32 bytes hex = 64 chars

      // Valida expiração de aproximadamente 1 hora (+/- 10s)
      const expiresAt = updateCall.data.resetTokenExpires as Date;
      const diffMinutes = (expiresAt.getTime() - Date.now()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThan(58);
      expect(diffMinutes).toBeLessThan(62);

      // Valida despacho de e-mail no devEmailService
      const sentEmail = devEmailService.getLastEmail();
      expect(sentEmail).toBeDefined();
      expect(sentEmail?.options.to).toBe("carlos@exemplo.com");
      expect(sentEmail?.options.subject).toContain("Redefinição de Senha");
      expect(sentEmail?.options.html).toContain(updateCall.data.resetToken);
      expect(sentEmail?.options.html).toContain("https://continentalestetica.com.br/reset-password?token=");
    });

    it("Defesa Anti-Enumeração: deve retornar sucesso uniforme quando o e-mail não existir na loja", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await requestPasswordReset({
        email: "inexistente@alvo.com",
        lojaID: "loja-continental-1",
      });

      // Retorno indistinguível de sucesso para o cliente
      expect(result.success).toBe(true);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(devEmailService.sentEmails.length).toBe(0);
    });

    it("Defesa de Conta: não deve gerar token para usuário BLOQUEADO, mas retorna sucesso uniforme", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr-blocked",
        name: "Infrator",
        email: "infrator@teste.com",
        status: "BLOCKED",
        lojaID: "loja-1",
      } as any);

      const result = await requestPasswordReset({
        email: "infrator@teste.com",
        lojaID: "loja-1",
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(devEmailService.sentEmails.length).toBe(0);
    });
  });

  describe("2. Testes de Serviço: resetPassword", () => {
    it("deve redefinir a senha com hash bcrypt, zerar o token e revogar sessões ativas", async () => {
      const mockUser = {
        id: "usr-456",
        email: "maria@exemplo.com",
        status: "ACTIVE",
        resetToken: "valid-64-character-token-hex-1234567890abcdef1234567890abcdef123456",
        resetTokenExpires: new Date(Date.now() + 1800000), // Válido por mais 30 min
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockUser as any);

      let txUpdatePayload: any = null;
      let txDeleteSessionPayload: any = null;

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
        return callback({
          user: {
            update: vi.fn().mockImplementation((args) => {
              txUpdatePayload = args;
              return args;
            }),
          },
          session: {
            deleteMany: vi.fn().mockImplementation((args) => {
              txDeleteSessionPayload = args;
              return { count: 1 };
            }),
          },
        });
      });

      const result = await resetPassword({
        token: "valid-64-character-token-hex-1234567890abcdef1234567890abcdef123456",
        newPassword: "NovaSenhaSegura#2026",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("sucesso");

      // Validação do hash
      expect(txUpdatePayload).toBeDefined();
      expect(txUpdatePayload.where).toEqual({ id: "usr-456" });
      expect(txUpdatePayload.data.resetToken).toBeNull();
      expect(txUpdatePayload.data.resetTokenExpires).toBeNull();

      const isPasswordHashed = await bcrypt.compare(
        "NovaSenhaSegura#2026",
        txUpdatePayload.data.password
      );
      expect(isPasswordHashed).toBe(true);

      // Validação de revogação de sessões
      expect(txDeleteSessionPayload).toEqual({
        where: { userId: "usr-456" },
      });
    });

    it("deve rejeitar se o token não for encontrado ou estiver expirado", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      await expect(
        resetPassword({
          token: "token-expirado-ou-inexistente",
          newPassword: "MinhaNovaSenha123",
        })
      ).rejects.toThrow(AuthError);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("deve rejeitar senha menor que 6 caracteres", async () => {
      await expect(
        resetPassword({
          token: "valid-token-long-enough-xyz",
          newPassword: "12345",
        })
      ).rejects.toThrow(AuthError);

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("3. Testes de Rota: POST /api/auth/forgot-password", () => {
    it("deve responder status 200 com mensagem padronizada", async () => {
      vi.mocked(tenant.getLojaFromHeaders).mockResolvedValueOnce({
        id: "loja-1",
        name: "Continental",
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.195",
        },
        body: JSON.stringify({ email: "cliente@teste.com" }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("instruções para redefinição");
    });

    it("deve rejeitar e-mail em formato inválido com 422", async () => {
      const req = new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.196",
        },
        body: JSON.stringify({ email: "email-invalido-sem-arroba" }),
      });

      const res = await forgotPasswordRoute(req);
      expect(res.status).toBe(422);
    });
  });

  describe("4. Testes de Rota: POST /api/auth/reset-password", () => {
    it("deve responder 400 Bad Request se o serviço rejeitar o token", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.197",
        },
        body: JSON.stringify({
          token: "token-invalido-de-teste-12345",
          password: "NovaSenhaValida123",
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("Token de recuperação inválido ou expirado");
    });

    it("deve responder 200 OK quando o token for válido e a senha redefinida", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: "usr-ok",
        email: "user@ok.com",
        status: "ACTIVE",
        resetToken: "valid-token-long-enough-1234567890",
        resetTokenExpires: new Date(Date.now() + 600000),
      } as any);

      vi.mocked(prisma.$transaction).mockResolvedValueOnce([{}, {}] as any);

      const req = new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.198",
        },
        body: JSON.stringify({
          token: "valid-token-long-enough-1234567890",
          password: "SenhaSuperSegura!123",
        }),
      });

      const res = await resetPasswordRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("sucesso");
    });
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
