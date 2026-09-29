import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset.template";
import { getEmailService, setEmailService } from "@/lib/email";

describe("segurança do canal de e-mail (FINAL-016/FINAL-032)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setEmailService(null);
  });

  it("escapa conteúdo controlável no HTML e preserva somente URL HTTPS validada", () => {
    const rendered = renderPasswordResetEmail({
      to: "cliente@exemplo.test",
      name: '<img src=x onerror="alert(1)">',
      storeName: '<script>alert("store")</script>',
      resetUrl: "https://loja-a.exemplo.test/reset-password?token=abc&source=email",
    });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("token=abc&amp;source=email");
  });

  it("rejeita protocolo executável no link", () => {
    expect(() => renderPasswordResetEmail({
      to: "cliente@exemplo.test",
      name: "Cliente",
      resetUrl: "javascript:alert(1)",
    })).toThrow("URL de redefinição inválida");
  });

  it("falha fechado em produção sem provedor transacional", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    setEmailService(null);
    expect(() => getEmailService()).toThrow("EMAIL_PROVIDER_NOT_CONFIGURED");
  });
});
