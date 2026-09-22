import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfileSchema } from "@/lib/validators/customer.validators";
import { updateUserProfile } from "@/services/customer.service";
import prisma from "@/lib/prisma";
import { PUT, GET } from "@/app/api/user/profile/route";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getCurrentUser } from "@/lib/session";

describe("Módulo de Atualização de Perfil do Cliente (ACT-P2-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Validações Zod (updateProfileSchema)", () => {
    it("deve aceitar dados válidos com nome e telefone", () => {
      const result = updateProfileSchema.safeParse({
        name: "Carlos Eduardo da Silva",
        phone: "(11) 98765-4321",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Carlos Eduardo da Silva");
        expect(result.data.phone).toBe("(11) 98765-4321");
      }
    });

    it("deve rejeitar nome com menos de 2 caracteres", () => {
      const result = updateProfileSchema.safeParse({
        name: "A",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("no mínimo 2 caracteres");
      }
    });

    it("deve converter string vazia de telefone em null", () => {
      const result = updateProfileSchema.safeParse({
        name: "Carlos Silva",
        phone: "   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBeNull();
      }
    });

    it("deve aceitar CPF/CNPJ opcional", () => {
      const result = updateProfileSchema.safeParse({
        name: "Carlos Silva",
        cpfCnpj: "52998224725",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cpfCnpj).toBe("52998224725");
      }
    });
  });

  describe("2. Camada de Serviço (updateUserProfile)", () => {
    const mockUser = {
      id: "user-123",
      lojaID: "loja-abc",
      cpfCnpj: "52998224725",
    };

    it("deve lançar USER_NOT_FOUND se o usuário não pertencer à loja (isolamento multi-tenant)", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      await expect(
        updateUserProfile({
          userId: "user-123",
          lojaID: "loja-errada",
          name: "Nome Inválido",
        })
      ).rejects.toThrow("USER_NOT_FOUND");
    });

    it("deve lançar CPF_ALREADY_IN_USE se outro usuário na mesma loja já utilizar o CPF informado", async () => {
      vi.mocked(prisma.user.findFirst)
        .mockResolvedValueOnce(mockUser as any) // check user
        .mockResolvedValueOnce({ id: "user-999", lojaID: "loja-abc" } as any); // conflict

      await expect(
        updateUserProfile({
          userId: "user-123",
          lojaID: "loja-abc",
          name: "Novo Nome",
          cpfCnpj: "11222333000181",
        })
      ).rejects.toThrow("CPF_ALREADY_IN_USE");
    });

    it("deve atualizar com sucesso os dados cadastrais", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: "user-123",
        name: "Carlos Atualizado",
        email: "carlos@teste.com",
        phone: "11999998888",
        cpfCnpj: "52998224725",
        role: "CUSTOMER",
        status: "ACTIVE",
        avatarImageUrl: null,
        lojaID: "loja-abc",
        createdAt: new Date(),
        updatedAt: new Date(),
        defaultAddressId: null,
      } as any);

      const result = await updateUserProfile({
        userId: "user-123",
        lojaID: "loja-abc",
        name: "Carlos Atualizado",
        phone: "11999998888",
      });

      expect(result.name).toBe("Carlos Atualizado");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-123" },
          data: expect.objectContaining({
            name: "Carlos Atualizado",
            phone: "11999998888",
          }),
        })
      );
    });
  });

  describe("3. Rota de API (app/api/user/profile)", () => {
    it("deve retornar 401 UNAUTHORIZED se o usuário não possuir sessão ativa", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const response = await PUT(
        new Request("http://localhost/api/user/profile", {
          method: "PUT",
          body: JSON.stringify({ name: "Carlos" }),
        })
      );

      const body = await response.json();
      expect(response.status).toBe(401);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("deve retornar 400 VALIDATION_ERROR se os dados enviados forem inválidos", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-123",
        lojaID: "loja-abc",
        name: "Carlos",
        email: "carlos@teste.com",
        role: "CUSTOMER",
        status: "ACTIVE",
      } as any);

      const response = await PUT(
        new Request("http://localhost/api/user/profile", {
          method: "PUT",
          body: JSON.stringify({ name: "" }), // Nome vazio
        })
      );

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("deve retornar 200 OK com dados atualizados se a requisição for válida", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-123",
        lojaID: "loja-abc",
        name: "Carlos",
        email: "carlos@teste.com",
        role: "CUSTOMER",
        status: "ACTIVE",
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: "user-123",
        lojaID: "loja-abc",
        cpfCnpj: null,
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: "user-123",
        name: "Carlos Silva",
        email: "carlos@teste.com",
        phone: "11988887777",
        cpfCnpj: null,
        role: "CUSTOMER",
        status: "ACTIVE",
        avatarImageUrl: null,
        lojaID: "loja-abc",
        createdAt: new Date(),
        updatedAt: new Date(),
        defaultAddressId: null,
      } as any);

      const response = await PUT(
        new Request("http://localhost/api/user/profile", {
          method: "PUT",
          body: JSON.stringify({
            name: "Carlos Silva",
            phone: "11988887777",
          }),
        })
      );

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Carlos Silva");
    });
  });
});
