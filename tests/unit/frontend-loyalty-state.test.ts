import { describe, expect, it } from "vitest";
import { readLoyaltySimulation, readLoyaltyStatement, readLoyaltyWallet } from "@/lib/loyalty-client";

const response = (status: number, body: unknown, invalidJson = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: invalidJson ? async () => { throw new SyntaxError("invalid"); } : async () => body,
}) as Response;

describe("envelopes de fidelidade não mascaram indisponibilidade como zero (FUX-008)", () => {
  it("aceita saldo zero somente em resposta válida", async () => {
    await expect(readLoyaltyWallet(response(200, {
      success: true,
      data: { wallet: { balance: 0, monetaryBalance: 0, pending: 0 } },
    }))).resolves.toEqual({ balance: 0, monetaryBalance: 0, pending: 0 });
  });

  it.each([
    response(500, { success: false }),
    response(200, { success: true, data: {} }),
    response(200, null, true),
  ])("recusa erro HTTP, envelope incompleto e JSON inválido", async (res) => {
    await expect(readLoyaltyWallet(res)).rejects.toThrow(/LOYALTY_/);
  });

  it("valida extrato e simulação antes de renderizar valores", async () => {
    await expect(readLoyaltyStatement(response(200, {
      success: true,
      data: {
        wallet: { balance: 0, pending: 0, lifetimeEarn: 0, monetaryBalance: 0 },
        items: [], total: 0, page: 1, limit: 10, totalPages: 0,
      },
    }))).resolves.toMatchObject({ items: [], total: 0 });

    await expect(readLoyaltySimulation(response(200, {
      success: true,
      data: {
        eligible: false,
        pointsToRedeem: 0,
        discountValue: 0,
        subtotalAfterDiscount: 100,
        projectedEarnedPoints: 10,
      },
    }))).resolves.toMatchObject({ eligible: false, discountValue: 0 });

    await expect(readLoyaltySimulation(response(200, {
      success: true,
      data: { eligible: true },
    }))).rejects.toThrow("LOYALTY_INVALID_SIMULATION");
  });
});
