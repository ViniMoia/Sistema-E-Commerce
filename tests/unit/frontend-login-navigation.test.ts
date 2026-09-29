import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "@/lib/safe-next-path";

describe("retorno seguro depois do login (FUX-014)", () => {
  it("preserva destinos internos, query e fragmento", () => {
    expect(getSafeNextPath("/profile/fidelidade?tab=extrato#saldo"))
      .toBe("/profile/fidelidade?tab=extrato#saldo");
    expect(getSafeNextPath(["/checkout", "/admin"])).toBe("/checkout");
  });

  it.each([
    undefined,
    "",
    "https://example.test/roubo",
    "//example.test/roubo",
    "/\\example.test",
    "/login?next=/login",
    "/profile\n/admin",
  ])("recusa destino inseguro ou circular: %s", (destination) => {
    expect(getSafeNextPath(destination)).toBe("/");
  });
});
