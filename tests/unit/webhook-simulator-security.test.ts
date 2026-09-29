import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { POST } from "@/app/api/webhooks/asaas/simulate/route";

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/services/order.service", () => ({ updateOrderStatus: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    order: { findFirst: vi.fn(), update: vi.fn() },
    paymentWebhookEvent: { create: vi.fn(), update: vi.fn() },
  },
}));

const request = (body: unknown) => new Request("http://localhost/api/webhooks/asaas/simulate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("isolamento do simulador de pagamento (FINAL-018)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fica inexistente sem opt-in explícito", async () => {
    vi.stubEnv("ENABLE_WEBHOOK_SIMULATOR", "");
    const response = await POST(request({ orderId: "pedido-a" }));
    expect(response.status).toBe(404);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("exige administrador quando habilitado", async () => {
    vi.stubEnv("ENABLE_WEBHOOK_SIMULATOR", "true");
    vi.mocked(requireAdmin).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any
    );
    const response = await POST(request({ orderId: "pedido-a" }));
    expect(response.status).toBe(401);
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });

  it("consulta pedido pela combinação id + tenant do administrador", async () => {
    vi.stubEnv("ENABLE_WEBHOOK_SIMULATOR", "true");
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: { id: "admin-a", role: "ADMIN", status: "ACTIVE", lojaID: "loja-a" },
    } as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null);

    const response = await POST(request({ orderId: "pedido-da-loja-b" }));
    expect(response.status).toBe(404);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "pedido-da-loja-b", lojaID: "loja-a" },
    }));
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("rejeita evento fora da allowlist antes de consultar pedido", async () => {
    vi.stubEnv("ENABLE_WEBHOOK_SIMULATOR", "true");
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: { id: "admin-a", role: "ADMIN", status: "ACTIVE", lojaID: "loja-a" },
    } as any);
    const response = await POST(request({ orderId: "pedido-a", event: "PAYMENT_DELETED" }));
    expect(response.status).toBe(400);
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });
});
