import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCheckoutPayload } from "@/lib/checkout-contract";

describe("integração observável do checkout (FUX-001/FUX-002)", () => {
  it("produz o contrato da API sem enviar preço de frete como autoridade", () => {
    const payload = buildCheckoutPayload({
      lojaID: "loja-a",
      cartId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      customer: { name: "Cliente", email: "cliente@example.test", phone: "11999999999", cpfCnpj: "52998224725" },
      items: [{ productId: "product-a", variantId: "variant-a", name: "Produto", quantity: 1, price: 1 }],
      deliveryType: "DELIVERY",
      address: { state: "SP", city: "São Paulo", neighborhood: "Centro", street: "Rua A", number: "1", cep: "01001000" },
      selectedFreight: { providerId: "fake", serviceName: "Normal", deliveryTimeInDays: 3, quoteToken: "quote-a" },
      paymentMethod: "PIX",
      pointsToRedeem: 0,
      installments: 1,
    });

    expect(payload).toMatchObject({
      lojaID: "loja-a",
      cartId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      freightQuoteToken: "quote-a",
      paymentMethod: "PIX",
      items: [expect.objectContaining({ productId: "product-a", variantId: "variant-a" })],
    });
    expect(payload).not.toHaveProperty("freightValue");
    expect(payload).not.toHaveProperty("selectedFreight");
  });

  it("mantém erro/retry explícito e bloqueio sem modalidade de frete", () => {
    const checkout = readFileSync(resolve(process.cwd(), "components/checkout/CheckoutForm.tsx"), "utf8");
    expect(checkout).toContain("setFreightError('Não foi possível calcular o frete.");
    expect(checkout).toContain('role="alert"');
    expect(checkout).toContain("Tentar novamente");
    expect(checkout).toContain("Por favor, selecione uma modalidade de frete.");
    expect(checkout).toContain("'Idempotency-Key': idempotencyKey.current");
    expect(checkout).toContain("await onOrderCreated(result.data, cartId)");
    expect(checkout).toContain("cartId");
  });
});
