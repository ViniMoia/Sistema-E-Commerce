import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { loginUser } from "@/services/auth.service";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
  },
}));

describe("resposta uniforme de autenticação (FINAL-035)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não distingue usuário inexistente de usuário bloqueado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const missing = loginUser({
      email: "ausente@exemplo.test",
      password: "SenhaQualquer123",
      lojaID: "loja-a",
    });
    await expect(missing).rejects.toThrow("Credenciais inválidas");

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "usuario-bloqueado",
      email: "bloqueado@exemplo.test",
      name: "Bloqueado",
      password: await bcrypt.hash("SenhaCorreta123", 10),
      role: "CUSTOMER",
      status: "BLOCKED",
      lojaID: "loja-a",
    } as any);
    const blocked = loginUser({
      email: "bloqueado@exemplo.test",
      password: "SenhaCorreta123",
      lojaID: "loja-a",
    });
    await expect(blocked).rejects.toThrow("Credenciais inválidas");
  });
});
