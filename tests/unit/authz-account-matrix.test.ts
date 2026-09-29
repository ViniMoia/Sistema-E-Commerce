import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST as setDefaultAddressRoute } from "@/app/api/address/set-default/route";
import { PATCH as updateRoleRoute } from "@/app/api/admin/users/[id]/role/route";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { setDefaultAddress } from "@/services/address.service";
import { updateUserRole } from "@/services/user.service";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/services/address.service", () => ({
  setDefaultAddress: vi.fn(),
}));

vi.mock("@/services/user.service", () => ({
  updateUserRole: vi.fn(),
}));

const jsonRequest = (url: string, method: string, body: unknown) => new Request(url, {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("matriz de autorização de endereço e mudança de papel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/address/set-default", () => {
    it("rejeita anônimo antes do serviço", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const response = await setDefaultAddressRoute(jsonRequest(
        "https://loja-a.test/api/address/set-default",
        "POST",
        { addressId: "address-a" },
      ));

      expect(response.status).toBe(401);
      expect(setDefaultAddress).not.toHaveBeenCalled();
    });

    it("usa customer A da sessão e rejeita endereço do customer B", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "customer-a", role: "CUSTOMER", status: "ACTIVE", lojaID: "loja-a" },
      } as any);
      vi.mocked(setDefaultAddress).mockRejectedValueOnce(
        new Error("Endereço não encontrado ou acesso não autorizado"),
      );
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await setDefaultAddressRoute(jsonRequest(
        "https://loja-a.test/api/address/set-default",
        "POST",
        { addressId: "address-b", userId: "customer-b" },
      ));

      expect(response.status).toBe(400);
      expect(setDefaultAddress).toHaveBeenCalledWith("customer-a", "address-b");
      consoleSpy.mockRestore();
    });

    it("permite ao customer A definir o próprio endereço", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "customer-a", role: "CUSTOMER", status: "ACTIVE", lojaID: "loja-a" },
      } as any);
      vi.mocked(setDefaultAddress).mockResolvedValueOnce({
        id: "customer-a",
        defaultAddressId: "address-a",
        lojaID: "loja-a",
      } as any);

      const response = await setDefaultAddressRoute(jsonRequest(
        "https://loja-a.test/api/address/set-default",
        "POST",
        { addressId: "address-a" },
      ));

      expect(response.status).toBe(200);
      expect(setDefaultAddress).toHaveBeenCalledWith("customer-a", "address-a");
    });

    it("não concede bypass de propriedade a admin", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "admin-a", role: "ADMIN", status: "ACTIVE", lojaID: "loja-a" },
      } as any);
      vi.mocked(setDefaultAddress).mockRejectedValueOnce(
        new Error("Endereço não encontrado ou acesso não autorizado"),
      );
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await setDefaultAddressRoute(jsonRequest(
        "https://loja-a.test/api/address/set-default",
        "POST",
        { addressId: "address-customer-b" },
      ));

      expect(response.status).toBe(400);
      expect(setDefaultAddress).toHaveBeenCalledWith("admin-a", "address-customer-b");
      consoleSpy.mockRestore();
    });
  });

  describe("PATCH /api/admin/users/[id]/role", () => {
    const context = { params: Promise.resolve({ id: "customer-target" }) };

    it("rejeita anônimo antes do serviço", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const response = await updateRoleRoute(jsonRequest(
        "https://loja-a.test/api/admin/users/customer-target/role",
        "PATCH",
        { role: "ADMIN" },
      ), context);

      expect(response.status).toBe(401);
      expect(updateUserRole).not.toHaveBeenCalled();
    });

    it("rejeita customer antes do serviço", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      );

      const response = await updateRoleRoute(jsonRequest(
        "https://loja-a.test/api/admin/users/customer-target/role",
        "PATCH",
        { role: "ADMIN" },
      ), context);

      expect(response.status).toBe(403);
      expect(updateUserRole).not.toHaveBeenCalled();
    });

    it("usa o admin da sessão como ator e não aceita actorId do corpo", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: "admin-a", role: "ADMIN", status: "ACTIVE", lojaID: "loja-a" },
      } as any);
      vi.mocked(updateUserRole).mockResolvedValueOnce({
        id: "customer-target",
        role: "ADMIN",
        lojaID: "loja-a",
      } as any);

      const response = await updateRoleRoute(jsonRequest(
        "https://loja-a.test/api/admin/users/customer-target/role",
        "PATCH",
        { role: "ADMIN", actorId: "admin-forjado", lojaID: "loja-b" },
      ), context);

      expect(response.status).toBe(200);
      expect(updateUserRole).toHaveBeenCalledWith("customer-target", "admin-a", "ADMIN");
    });

    it("oculta alvo de outro tenant do admin", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: "admin-a", role: "ADMIN", status: "ACTIVE", lojaID: "loja-a" },
      } as any);
      vi.mocked(updateUserRole).mockRejectedValueOnce(new Error("USER_NOT_FOUND"));

      const response = await updateRoleRoute(jsonRequest(
        "https://loja-a.test/api/admin/users/customer-b/role",
        "PATCH",
        { role: "ADMIN" },
      ), { params: Promise.resolve({ id: "customer-b" }) });

      expect(response.status).toBe(404);
    });
  });
});
