import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({ default: { loja: {} } }));

import { getTenantCanonicalOrigin, selectRequestHost, type TenantContext } from "@/lib/tenant";

const tenant: TenantContext = {
  id: "loja-a",
  name: "Loja A",
  slug: "loja-a",
  description: "",
  coverImageUrl: "",
};

describe("origem canônica de links sensíveis (FINAL-012)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefere domínio customizado validado do tenant", () => {
    expect(getTenantCanonicalOrigin({ ...tenant, customDomain: "conta.exemplo.test" }))
      .toBe("https://conta.exemplo.test");
  });

  it("compõe subdomínio apenas com PLATFORM_DOMAIN válido", () => {
    vi.stubEnv("PLATFORM_DOMAIN", "plataforma.exemplo.test");
    expect(getTenantCanonicalOrigin(tenant)).toBe("https://loja-a.plataforma.exemplo.test");
  });

  it("falha fechado em produção quando a origem confiável não está configurada", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLATFORM_DOMAIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getTenantCanonicalOrigin(tenant)).toBeNull();
  });

  it("rejeita domínio configurado com esquema, caminho ou caracteres de injeção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLATFORM_DOMAIN", "");
    expect(getTenantCanonicalOrigin({
      ...tenant,
      customDomain: "https://atacante.exemplo.test/reset",
    })).toBeNull();
  });
});

describe("trust boundary do host encaminhado (INF-014)", () => {
  it("ignora x-forwarded-host sem proxy explicitamente confiável", () => {
    expect(selectRequestHost("loja-a.exemplo.test", "loja-b.exemplo.test", ""))
      .toBe("loja-a.exemplo.test");
  });

  it("aceita um único host encaminhado de provider allowlisted", () => {
    expect(selectRequestHost("proxy.internal", "loja-a.exemplo.test", "vercel"))
      .toBe("loja-a.exemplo.test");
  });

  it("rejeita cadeia ambígua mesmo com proxy confiável", () => {
    expect(selectRequestHost("proxy.internal", "loja-a.exemplo.test, atacante.test", "generic"))
      .toBe("");
  });
});
