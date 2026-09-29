import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { getLojaBySlug, getLojaSettings } from "@/services/loja.service";
import { getProductById } from "@/services/product.service";

vi.mock("@/lib/prisma", () => ({
  default: {
    loja: {
      findUnique: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  tenantCache: {
    getOrSet: vi.fn(async (_tenant: string, _scope: string, _key: string, loader: () => unknown) => loader()),
    invalidateTenant: vi.fn(),
  },
}));

describe("fronteira pública de dados da loja (FINAL-010)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seleciona apenas campos públicos ao consultar loja por slug", async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce(null);

    await getLojaBySlug("loja-a");

    const select = vi.mocked(prisma.loja.findUnique).mock.calls[0][0].select as Record<string, boolean>;
    expect(select).toEqual({
      id: true,
      name: true,
      slug: true,
      description: true,
      coverImageUrl: true,
      whatsappNumber: true,
      primaryColor: true,
      secondaryColor: true,
    });
    expect(select).not.toHaveProperty("correiosPassword");
    expect(select).not.toHaveProperty("correiosContractCode");
    expect(select).not.toHaveProperty("originStreet");
    expect(select).not.toHaveProperty("pixKey");
  });

  it("não devolve a senha dos Correios nem no DTO administrativo", async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce(null);

    await getLojaSettings("loja-a");

    const select = vi.mocked(prisma.loja.findUnique).mock.calls[0][0].select as Record<string, boolean>;
    expect(select).not.toHaveProperty("correiosPassword");
  });

  it("restringe o produto ao tenant e usa DTO explícito para a relação loja", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null);

    await expect(getProductById("produto-b", "loja-a")).rejects.toThrow("PRODUCT_NOT_FOUND");

    const query = vi.mocked(prisma.product.findFirst).mock.calls[0][0];
    expect(query.where).toEqual({ id: "produto-b", lojaID: "loja-a" });
    expect(query.include?.loja).not.toBe(true);
    const select = (query.include?.loja as { select: Record<string, boolean> }).select;
    expect(select).not.toHaveProperty("correiosPassword");
    expect(select).not.toHaveProperty("pixKey");
  });
});
