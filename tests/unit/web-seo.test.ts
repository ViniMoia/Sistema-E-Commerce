import { beforeEach, describe, expect, it, vi } from "vitest";
import { productPath, serializeJsonLd, toAbsoluteHttpUrl } from "@/lib/web-seo";
import { getLojaFromHeaders, getTenantCanonicalOrigin } from "@/lib/tenant";
import { getProducts } from "@/services/product.service";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

vi.mock("@/lib/tenant", () => ({
  getLojaFromHeaders: vi.fn(),
  getTenantCanonicalOrigin: vi.fn(),
}));

vi.mock("@/services/product.service", () => ({
  getProducts: vi.fn(),
}));

describe("SEO web tenant-aware (WEB-001/002/003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLojaFromHeaders).mockResolvedValue({
      id: "loja-a",
      name: "Loja A",
      slug: "loja-a",
      description: "Descrição",
      coverImageUrl: "/cover.jpg",
    });
    vi.mocked(getTenantCanonicalOrigin).mockReturnValue("https://loja-a.example.com");
  });

  it("falha fechado em robots quando não há origem canônica confiável", async () => {
    vi.mocked(getTenantCanonicalOrigin).mockReturnValue(null);

    await expect(robots()).resolves.toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("publica sitemap canônico somente com home e produtos públicos do tenant", async () => {
    const updatedAt = new Date("2026-09-27T12:00:00.000Z");
    vi.mocked(getProducts).mockResolvedValueOnce([
      { id: "produto/a", imageUrl: "https://cdn.example.com/a.jpg", updatedAt } as any,
    ]);

    const entries = await sitemap();

    expect(getProducts).toHaveBeenCalledWith({ lojaId: "loja-a", all: true });
    expect(entries).toEqual([
      expect.objectContaining({ url: "https://loja-a.example.com", priority: 1 }),
      expect.objectContaining({
        url: "https://loja-a.example.com/produto/produto%2Fa",
        lastModified: updatedAt,
        images: ["https://cdn.example.com/a.jpg"],
      }),
    ]);
    expect(JSON.stringify(entries)).not.toMatch(/admin|checkout|profile|api\//);
  });

  it("gera URL estável e serializa JSON-LD sem permitir fechamento de script", () => {
    expect(productPath("id/com espaço")).toBe("/produto/id%2Fcom%20espa%C3%A7o");
    expect(toAbsoluteHttpUrl("/imagem.jpg", "https://loja.example.com")).toBe(
      "https://loja.example.com/imagem.jpg"
    );
    expect(toAbsoluteHttpUrl("javascript:alert(1)", "https://loja.example.com")).toBeNull();
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });
});
