import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import HomeClient, { type Product } from "@/components/home/HomeClient";

const harness = vi.hoisted(() => ({
  states: [] as any[], cursor: 0, products: [] as any[], addToCart: vi.fn(), setIsOpen: vi.fn(), toast: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: any) => {
      const slot = harness.cursor++;
      if (!(slot in harness.states)) harness.states[slot] = initial;
      return [harness.states[slot], (value: any) => { harness.states[slot] = value; }];
    },
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useCallback: (callback: any) => callback,
  };
});
vi.mock("@/store/cart.store", () => ({ useCartStore: () => ({ addToCart: harness.addToCart, isLoading: false }) }));
vi.mock("@/components/providers/CartProvider", () => ({ useCart: () => ({ setIsOpen: harness.setIsOpen }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: harness.toast }) }));
vi.mock("@/hooks/useProductFilters", () => ({ useProductFilters: () => ({
  filteredProducts: harness.products, paginatedProducts: harness.products, currentPage: 1,
  totalPages: 1, pageSize: 12, startIndex: 1, endIndex: harness.products.length,
  totalCount: harness.products.length, filteredCount: harness.products.length, brandsWithCounts: [],
}) }));
vi.mock("@/components/home/HeroVideo", () => ({ default: () => null }));
vi.mock("@/components/catalog/ProductFreightCalculator", () => ({ ProductFreightCalculator: () => null }));

const variant = (id: string, size = "Único", color = "Padrão", stock = 10) => ({ id, size, color, stock });
const product = (id: string, variants: Product["productVariants"]): Product => ({
  id, name: "Produto " + id, description: "Descrição", price: 10,
  imageUrl: "https://example.com/p.png", stock: 10, productVariants: variants,
});
const event = () => ({ stopPropagation: vi.fn() } as any);
function render() {
  harness.cursor = 0;
  return HomeClient({ initialProducts: harness.products, lojaInfo: null });
}
function elements(node: any): ReactElement<any>[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  if (typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
function text(node: any): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join("");
  return node?.props ? text(node.props.children) : "";
}
const button = (tree: any, label: string) => elements(tree).find((el) => el.type === "button" && text(el) === label)!;

beforeEach(() => {
  vi.clearAllMocks();
  harness.states = [];
  harness.products = [];
  harness.addToCart.mockResolvedValue(undefined);
});

describe("Eventos do catálogo para compra", () => {
  it("compra o Aspirador com duplicatas neutras sem seletores nem alerta", async () => {
    const aspirador = product("aspirador", [variant("original", "Padrão"), variant("duplicada", "Padrão")]);
    harness.states = [aspirador, null, null, null];
    const tree = render();
    expect(elements(tree).filter((el) => el.type === "fieldset")).toHaveLength(0);
    await button(tree, "Finalizar Compra").props.onClick(event());
    expect(harness.addToCart).toHaveBeenCalledWith("original", "aspirador", 1);
    expect(harness.setIsOpen).toHaveBeenCalledWith(true);
    expect(harness.toast).not.toHaveBeenCalled();
  });
  it("mostra apenas tamanhos e compra a embalagem escolhida sem exigir cor", async () => {
    const prod = product("frasco", [variant("small", "500ml"), variant("large", "1L")]);
    harness.states = [prod, null, null, null];
    let tree = render();
    expect(elements(tree).filter((el) => el.type === "fieldset")).toHaveLength(1);
    await button(tree, "Finalizar Compra").props.onClick(event());
    expect(harness.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Selecione um tamanho para continuar." }));
    button(tree, "1L").props.onClick();
    tree = render();
    expect(button(tree, "1L").props["aria-pressed"]).toBe(true);
    await button(tree, "Finalizar Compra").props.onClick(event());
    expect(harness.addToCart).toHaveBeenCalledWith("large", "frasco", 1);
  });
  it("mostra apenas cores e compra sem exigir tamanho", async () => {
    const prod = product("cor", [variant("black", "Padrão", "Preto"), variant("red", "Único", "Vermelho")]);
    harness.states = [prod, null, null, null];
    let tree = render();
    expect(elements(tree).filter((el) => el.type === "fieldset")).toHaveLength(1);
    button(tree, "Vermelho").props.onClick();
    tree = render();
    await button(tree, "Finalizar Compra").props.onClick(event());
    expect(harness.addToCart).toHaveBeenCalledWith("red", "cor", 1);
  });
  it("limpa uma cor incompatível ao trocar o tamanho e desabilita a combinação ausente", () => {
    const prod = product("grade", [variant("a", "P", "Preto"), variant("b", "M", "Azul")]);
    harness.states = [prod, "P", "Preto", null];
    button(render(), "M").props.onClick();
    const tree = render();
    expect(harness.states[2]).toBeNull();
    expect(button(tree, "Preto").props.disabled).toBe(true);
    expect(button(tree, "Azul").props.disabled).toBe(false);
  });
  it("o card abre o produto com opções e limpa a seleção anterior", () => {
    const prod = product("grade", [variant("a", "P"), variant("b", "M")]);
    harness.products = [prod];
    harness.states = [null, "M", "Azul", null];
    const tree = render();
    const cardButton = elements(tree).find((el) => el.props.title === "Adicionar ao Carrinho")!;
    cardButton.props.onClick(event());
    expect(harness.states.slice(0, 3)).toEqual([prod, null, null]);
    expect(harness.addToCart).not.toHaveBeenCalled();
  });
  it("o card de um produto simples usa sua própria variante, mesmo com seleção antiga", () => {
    const prod = product("outro", [variant("other-id")]);
    harness.products = [prod];
    harness.states = [null, "M", "Preto", null];
    const tree = render();
    elements(tree).find((el) => el.props.title === "Adicionar ao Carrinho")!.props.onClick(event());
    expect(harness.addToCart).toHaveBeenCalledWith("other-id", "outro", 1);
  });
  it("não envia uma variante sem estoque e mostra falhas da API", async () => {
    harness.states = [product("vazio", [variant("v", "Único", "Padrão", 0)]), null, null, null];
    await button(render(), "Finalizar Compra").props.onClick(event());
    expect(harness.addToCart).not.toHaveBeenCalled();
    expect(harness.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Produto indisponível" }));
    harness.states = [product("ok", [variant("v")]), null, null, null];
    harness.addToCart.mockRejectedValue(new Error("Estoque insuficiente"));
    await button(render(), "Finalizar Compra").props.onClick(event());
    expect(harness.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Estoque insuficiente" }));
  });
});
