import type { LoyaltyStatementResult } from "@/types/loyalty.types";

export interface LoyaltyWalletView {
  balance: number;
  monetaryBalance: number;
  pending: number;
}

export interface LoyaltySimulationView {
  eligible: boolean;
  pointsToRedeem: number;
  discountValue: number;
  subtotalAfterDiscount: number;
  projectedEarnedPoints: number;
  reason?: string;
}

async function readEnvelope(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`LOYALTY_HTTP_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error("LOYALTY_INVALID_JSON");
  }
}

export async function readLoyaltyStatement(response: Response): Promise<LoyaltyStatementResult> {
  const envelope = await readEnvelope(response) as { success?: unknown; data?: unknown };
  const data = envelope?.data as Partial<LoyaltyStatementResult> | undefined;
  if (
    envelope?.success !== true ||
    !data ||
    !data.wallet ||
    typeof data.wallet.balance !== "number" ||
    typeof data.wallet.pending !== "number" ||
    typeof data.wallet.lifetimeEarn !== "number" ||
    typeof data.wallet.monetaryBalance !== "number" ||
    !Array.isArray(data.items) ||
    typeof data.total !== "number" ||
    typeof data.page !== "number" ||
    typeof data.limit !== "number" ||
    typeof data.totalPages !== "number"
  ) {
    throw new Error("LOYALTY_INVALID_STATEMENT");
  }
  return data as LoyaltyStatementResult;
}

export async function readLoyaltyWallet(response: Response): Promise<LoyaltyWalletView> {
  const envelope = await readEnvelope(response) as { success?: unknown; data?: { wallet?: Partial<LoyaltyWalletView> } };
  const wallet = envelope?.data?.wallet;
  if (
    envelope?.success !== true ||
    !wallet ||
    typeof wallet.balance !== "number" ||
    typeof wallet.monetaryBalance !== "number" ||
    typeof wallet.pending !== "number"
  ) {
    throw new Error("LOYALTY_INVALID_WALLET");
  }
  return wallet as LoyaltyWalletView;
}

export async function readLoyaltySimulation(response: Response): Promise<LoyaltySimulationView> {
  const envelope = await readEnvelope(response) as { success?: unknown; data?: Partial<LoyaltySimulationView> };
  const simulation = envelope?.data;
  if (
    envelope?.success !== true ||
    !simulation ||
    typeof simulation.eligible !== "boolean" ||
    typeof simulation.pointsToRedeem !== "number" ||
    typeof simulation.discountValue !== "number" ||
    typeof simulation.subtotalAfterDiscount !== "number" ||
    typeof simulation.projectedEarnedPoints !== "number"
  ) {
    throw new Error("LOYALTY_INVALID_SIMULATION");
  }
  return simulation as LoyaltySimulationView;
}
