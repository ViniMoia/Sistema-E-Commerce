import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "@/app/api/orders/[id]/route";
import { requireAuth } from "@/lib/auth/guards";
import { getOrderById } from "@/services/order.service";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/services/order.service", () => ({
  getOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("autorização por proprietário e tenant no detalhe de pedido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita acesso anônimo antes de consultar o pedido", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET(
      new Request("https://loja-a.test/api/orders/order-a"),
      context("order-a"),
    );

    expect(response.status).toBe(401);
    expect(getOrderById).not.toHaveBeenCalled();
  });

  it("rejeita customer A ao consultar pedido do customer B", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "customer-a", role: "CUSTOMER", status: "ACTIVE", lojaID: "loja-a" },
    } as any);
    vi.mocked(getOrderById).mockResolvedValueOnce({
      id: "order-b",
      userID: "customer-b",
      lojaID: "loja-a",
    } as any);

    const response = await GET(
      new Request("https://loja-a.test/api/orders/order-b"),
      context("order-b"),
    );

    expect(response.status).toBe(403);
  });

  it("rejeita registro legado do customer A associado a outro tenant", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "customer-a", role: "CUSTOMER", status: "ACTIVE", lojaID: "loja-a" },
    } as any);
    vi.mocked(getOrderById).mockResolvedValueOnce({
      id: "order-cross-tenant",
      userID: "customer-a",
      lojaID: "loja-b",
    } as any);

    const response = await GET(
      new Request("https://loja-a.test/api/orders/order-cross-tenant"),
      context("order-cross-tenant"),
    );

    expect(response.status).toBe(404);
  });

  it("permite ao customer A consultar somente o próprio pedido da loja A", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "customer-a", role: "CUSTOMER", status: "ACTIVE", lojaID: "loja-a" },
    } as any);
    vi.mocked(getOrderById).mockResolvedValueOnce({
      id: "order-a",
      userID: "customer-a",
      lojaID: "loja-a",
      status: "PAID",
    } as any);

    const response = await GET(
      new Request("https://loja-a.test/api/orders/order-a"),
      context("order-a"),
    );

    expect(response.status).toBe(200);
  });

  it("rejeita admin da loja A ao consultar pedido da loja B", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "admin-a", role: "ADMIN", status: "ACTIVE", lojaID: "loja-a" },
    } as any);
    vi.mocked(getOrderById).mockResolvedValueOnce({
      id: "order-b",
      userID: "customer-b",
      lojaID: "loja-b",
    } as any);

    const response = await GET(
      new Request("https://loja-a.test/api/orders/order-b"),
      context("order-b"),
    );

    expect(response.status).toBe(404);
  });
});
