import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductForm } from "@/components/admin/ProductForm";

const harness = vi.hoisted(() => ({
  form: null as any, submit: null as any, fetch: vi.fn(), toast: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => harness.router }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: harness.toast }) }));
vi.mock("@/components/admin/ProductImageUpload", () => ({ ProductImageUpload: () => null }));
vi.mock("react-hook-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hook-form")>();
  return { ...actual, useForm: (options: any) => {
    harness.form = actual.useForm(options);
    return harness.form;
  } };
});
vi.mock("@/components/ui/form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/form")>();
  const { createElement, Children } = await import("react");
  return { ...actual, Form: (props: any) => {
    const formElement = Children.toArray(props.children).find((child: any) => child.type === "form") as any;
    harness.submit = formElement.props.onSubmit;
    return createElement(actual.Form, props);
  } };
});

beforeEach(() => {
  vi.clearAllMocks();
  harness.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => vi.unstubAllGlobals());

const initial = {
  id: "product", name: "Aspirador de Pó", description: "Descrição completa do produto",
  price: 11.95, imageUrl: "https://example.com/p.png", stock: 1,
  productVariants: [{ id: "persisted-id", size: "Único", color: "Padrão", stock: 10 }],
};

describe("Payload real do formulário administrativo", () => {
  it("preserva o ID persistido em três salvamentos usando o resolver e o useFieldArray reais", async () => {
    let current = initial;
    for (let attempt = 0; attempt < 3; attempt++) {
      renderToStaticMarkup(createElement(ProductForm, { lojaID: "store", productId: "product", initialData: current }));
      expect(harness.form.getValues("variants")[0].id).toBe("persisted-id");
      await harness.submit();
      const [url, options] = harness.fetch.mock.calls[attempt];
      const payload = JSON.parse(options.body);
      expect(url).toBe("/api/products/product");
      expect(options.method).toBe("PUT");
      expect(payload.variants[0].id).toBe("persisted-id");
      current = { ...initial, productVariants: payload.variants };
    }
    expect(harness.fetch).toHaveBeenCalledTimes(3);
  });
  it("envia o tamanho canônico no cadastro de um produto sem variantes", async () => {
    renderToStaticMarkup(createElement(ProductForm, {
      lojaID: "store", initialData: { ...initial, productVariants: [] },
    }));
    await harness.submit();
    const [url, options] = harness.fetch.mock.calls[0];
    expect(url).toBe("/api/products");
    expect(JSON.parse(options.body).variants).toEqual([{ size: "Único", color: "Padrão", stock: 10 }]);
  });
});
