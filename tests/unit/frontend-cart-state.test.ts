import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/store/cart.store";

const response = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response;

describe("estado observável do carrinho (FUX-003/FUX-010)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCartStore.setState({ cart: null, isLoading: false, status: "idle", error: null });
  });

  it("não representa indisponibilidade como carrinho vazio e permite retry", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200, { id: "cart-a", userID: "user-a", status: "ACTIVE", items: [] })));

    await useCartStore.getState().fetchCart();
    expect(useCartStore.getState()).toMatchObject({ status: "error", cart: null });
    expect(useCartStore.getState().error).toContain("carregar");

    await useCartStore.getState().fetchCart();
    expect(useCartStore.getState()).toMatchObject({ status: "empty", error: null });
  });

  it("distingue autenticação ausente de carrinho vazio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)));
    await useCartStore.getState().fetchCart();
    expect(useCartStore.getState()).toMatchObject({ status: "unauthorized", cart: null });
  });

  it("expõe falha de adição para que a tela informe ou redirecione", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)));
    await expect(useCartStore.getState().addToCart("variant-a", "product-a", 1))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(useCartStore.getState().error).toContain("Entre na sua conta");
  });

  it("reverte atualização otimista e mantém erro visível", async () => {
    const cart = {
      id: "cart-a",
      userID: "user-a",
      status: "ACTIVE",
      items: [{
        id: "item-a",
        cartID: "cart-a",
        productID: "product-a",
        variantID: "variant-a",
        quantity: 1,
        productName: "Produto",
        price: 10,
        color: "Padrão",
        size: "Único",
        imageUrl: "/produto.png",
      }],
    };
    useCartStore.setState({ cart, status: "success" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(409)));

    await useCartStore.getState().updateQuantity("variant-a", 2);
    expect(useCartStore.getState().cart?.items[0].quantity).toBe(1);
    expect(useCartStore.getState().error).toContain("estoque mudou");
  });

  it("reconcilia o carrinho concluído com o servidor em vez de limpar outro checkout", async () => {
    const purchasedCart = {
      id: "cart-a",
      userID: "user-a",
      status: "ACTIVE",
      items: [{
        id: "item-a", cartID: "cart-a", productID: "product-a", variantID: "variant-a",
        quantity: 1, productName: "Produto A", price: 10, color: "Preto", size: "U", imageUrl: "/a.png",
      }],
    };
    const nextCart = {
      id: "cart-b",
      userID: "user-a",
      status: "ACTIVE",
      items: [{
        id: "item-b", cartID: "cart-b", productID: "product-b", variantID: "variant-b",
        quantity: 1, productName: "Produto B", price: 20, color: "Azul", size: "M", imageUrl: "/b.png",
      }],
    };
    useCartStore.setState({ cart: purchasedCart, status: "success" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, nextCart)));

    await useCartStore.getState().reconcileAfterCheckout("cart-a");

    expect(useCartStore.getState()).toMatchObject({ cart: nextCart, status: "success", error: null });
  });
});
