import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getLojaFromHeaders } from "@/lib/tenant";
import { createSession, deleteSession, getCurrentUser } from "@/lib/session";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getLojaFromHeaders: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    session: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("tokens e vínculo tenant de sessão (FINAL-016)", () => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);
  });

  it("persiste somente hash do token e entrega o valor bruto apenas no cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "sessao-anterior" });
    vi.mocked(prisma.session.create).mockImplementationOnce((async ({ data }: any) => data) as any);

    await createSession("usuario-a");

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: sha256("sessao-anterior") },
    });
    const persistedId = vi.mocked(prisma.session.create).mock.calls[0][0].data.id;
    const rawCookie = cookieStore.set.mock.calls[0][1] as string;
    expect(persistedId).toBe(sha256(rawCookie));
    expect(rawCookie).not.toBe(persistedId);
  });

  it("não apaga o cookie nem simula sucesso quando a revogação no banco falha", async () => {
    cookieStore.get.mockReturnValue({ value: "sessao-atual" });
    vi.mocked(prisma.session.deleteMany).mockRejectedValueOnce(new Error("database unavailable"));

    await expect(deleteSession()).rejects.toThrow("database unavailable");
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("não cria nova sessão quando não consegue invalidar o cookie anterior", async () => {
    cookieStore.get.mockReturnValue({ value: "sessao-anterior" });
    vi.mocked(prisma.session.deleteMany).mockRejectedValueOnce(new Error("database unavailable"));

    await expect(createSession("usuario-a")).rejects.toThrow("database unavailable");
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("responde 503 no logout quando a revogação não pode ser confirmada", async () => {
    cookieStore.get.mockReturnValue({ value: "sessao-atual" });
    vi.mocked(prisma.session.deleteMany).mockRejectedValueOnce(new Error("database unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await logoutRoute(new Request("https://loja-a.exemplo.test/api/auth/logout", {
      method: "POST",
    }));

    expect(response.status).toBe(503);
    expect(cookieStore.delete).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("rejeita sessão válida de usuário pertencente a outro tenant", async () => {
    cookieStore.get.mockReturnValue({ value: "token-bruto" });
    vi.mocked(prisma.session.findUnique).mockResolvedValueOnce({
      id: sha256("token-bruto"),
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "usuario-a",
        name: "A",
        email: "a@exemplo.test",
        role: "CUSTOMER",
        status: "ACTIVE",
        lojaID: "loja-a",
      },
    } as any);
    vi.mocked(getLojaFromHeaders).mockResolvedValueOnce({ id: "loja-b" } as any);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prisma.session.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: sha256("token-bruto") },
    }));
  });
});
