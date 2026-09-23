import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config.js";
import { logger, maskCpfCnpj, sanitizeLogValue } from "@/lib/logger";

describe("Segurança HTTP, CSP e Observabilidade (Fase 5 - ACT-P3-01 e ACT-P3-02)", () => {
  describe("1. Políticas de Segurança e Cabeçalhos HTTP (next.config.js)", () => {
    it("deve definir cabeçalhos de segurança para todas as rotas (/:path*)", async () => {
      const headersConfig = await nextConfig.headers();
      expect(headersConfig).toBeDefined();
      expect(Array.isArray(headersConfig)).toBe(true);

      const rootHeaderRule = headersConfig.find((rule: any) => rule.source === "/:path*");
      expect(rootHeaderRule).toBeDefined();

      const headersMap = new Map<string, string>();
      rootHeaderRule.headers.forEach((h: { key: string; value: string }) => {
        headersMap.set(h.key.toLowerCase(), h.value);
      });

      // Proteção contra Clickjacking e Mime-sniffing
      expect(headersMap.get("x-frame-options")).toBe("DENY");
      expect(headersMap.get("x-content-type-options")).toBe("nosniff");
      expect(headersMap.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(headersMap.get("strict-transport-security")).toContain("max-age=63072000");

      // Content-Security-Policy (CSP) estrito
      const csp = headersMap.get("content-security-policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("https://*.supabase.co");
      expect(csp).toContain("https://viacep.com.br");
      expect(csp).toContain("https://api.qrserver.com");
      expect(csp).toContain("https://api.asaas.com");
      expect(csp).toContain("https://*.mitiendanube.com");
      expect(csp).toContain("https://res.cloudinary.com");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("deve incluir api.qrserver.com, *.mitiendanube.com e *.supabase.co nos domínios remotos de imagens", () => {
      const patterns = nextConfig.images?.remotePatterns || [];
      const hostnames = patterns.map((p: any) => p.hostname);

      expect(hostnames).toContain("*.supabase.co");
      expect(hostnames).toContain("api.qrserver.com");
      expect(hostnames).toContain("*.mitiendanube.com");
      expect(hostnames).toContain("res.cloudinary.com");
    });
  });

  describe("2. Logger Estruturado e Sanitização de Dados Sensíveis", () => {
    it("deve mascarar números de CPF nos logs de observabilidade", () => {
      const maskedCpf = maskCpfCnpj("52998224725");
      expect(maskedCpf).toBe("529.***.***-25");
      expect(maskedCpf).not.toContain("982247");
    });

    it("deve mascarar números de CNPJ nos logs de observabilidade", () => {
      const maskedCnpj = maskCpfCnpj("11222333000181");
      expect(maskedCnpj).toBe("11.***.***/****-81");
      expect(maskedCnpj).not.toContain("222333");
    });

    it("deve ocultar chaves de API, senhas e tokens nos logs", () => {
      expect(sanitizeLogValue("apiKey", "minha_chave_super_secreta")).toBe("[REDACTED]");
      expect(sanitizeLogValue("password", "senha123456")).toBe("[REDACTED]");
      expect(sanitizeLogValue("token", "bearer_jwt_token")).toBe("[REDACTED]");
      expect(sanitizeLogValue("secret", "cron_secret_123")).toBe("[REDACTED]");
    });

    it("deve gerar log estruturado com level, timestamp e contexto", () => {
      const log = logger.error("Erro simulado de teste", new Error("Falha no banco"), {
        action: "TEST_ACTION",
        tenantId: "loja-123",
        document: "52998224725",
      });

      expect(log.level).toBe("error");
      expect(log.message).toBe("Erro simulado de teste");
      expect(log.error?.message).toBe("Falha no banco");
      expect(log.context?.action).toBe("TEST_ACTION");
      expect(log.context?.tenantId).toBe("loja-123");
      expect(log.context?.document).toBe("529.***.***-25");
    });
  });
});
