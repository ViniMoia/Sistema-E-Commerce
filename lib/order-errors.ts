import { NextResponse } from "next/server";
import { OrderError } from "@/services/order.service";

// Error code → HTTP status map shared by all order routes
export const ORDER_ERROR_MAP: Record<string, number> = {
  CART_NOT_FOUND: 404,
  CART_ACCESS_DENIED: 403,
  CART_NOT_ACTIVE: 400,
  CART_IS_EMPTY: 400,
  ADDRESS_NOT_FOUND: 404,
  ADDRESS_ACCESS_DENIED: 403,
  ORDER_NOT_FOUND: 404,
  INSUFFICIENT_STOCK: 409,
};

export function handleOrderError(error: unknown): NextResponse {
  if (error instanceof OrderError) {
    // Extract the base code before any ":" (e.g. "INSUFFICIENT_STOCK:variantId:...")
    const code = error.message.split(":")[0];
    const status = ORDER_ERROR_MAP[code] ?? 400;
    return NextResponse.json({ error: code }, { status });
  }
  console.error("[ORDER_SERVICE_ERROR]", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
