import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductForm } from "@/components/admin/ProductForm";

const harness = vi.hoisted(() => ({
  form: null as any, submit: null as any, inventoryRead: null as any, fetch: vi.fn(), toast: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => harness.router }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: harness.toast }) }));
vi.mock("@/components/admin/ProductImageUpload", () => ({ ProductImageUpload: () => null }));
vi.mock("@/components/admin/InventoryPanel", () => ({ InventoryPanel: (props: any) => {
  harness.inventoryRead = props.onInventoryRead;
  return null;
} }));
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
  price: 11.95, imageUrl: "https://example.com/p.png", stock: 1, catalogVersion: 0,
  productVariants: [{ id: "persisted-id", size: "Único", color: "Padrão", stock: 10 }],
};

describe("Payload real do formulário administrativo", () => {
  it('refreshes stock by persisted variant ID while preserving unsaved catalog edits and inventory-free save', async () => {
    renderToStaticMarkup(createElement(ProductForm, { lojaID: 'store', productId: 'product', initialData: initial }));
    // SSR has no mounting effects; subscribe through RHF's public API so reads
    // observe live values, as they do in the mounted browser form.
    const unsubscribe = harness.form.subscribe({ formState: { values: true }, callback: () => {} });
    harness.form.setValue('name', 'Nome ainda não salvo', { shouldDirty: true });
    harness.form.setValue('price', 49.90, { shouldDirty: true });
    harness.form.setValue('variants', [
      { size: 'Nova', color: 'Azul', stock: 0 },
      { id: 'persisted-id', size: 'Tamanho editado', color: 'Vermelho', stock: 10 },
    ]);
    harness.inventoryRead({ id: 'product', stock: 100, productVariants: [
      { id: 'persisted-id', stock: 25, size: 'Único', color: 'Padrão' },
      { id: 'not-in-draft', stock: 50 },
    ] });
    expect(harness.form.getValues()).toMatchObject({ name: 'Nome ainda não salvo', price: 49.9, stock: 100,
      variants: [{ size: 'Nova', color: 'Azul', stock: 0 }, { id: 'persisted-id', size: 'Tamanho editado', color: 'Vermelho', stock: 25 }] });
    expect(harness.fetch).not.toHaveBeenCalled();
    await harness.submit();
    const payload = JSON.parse(harness.fetch.mock.calls[0][1].body);
    expect(payload.stock).toBeUndefined();
    expect(payload.expectedCatalogVersion).toBe(0);
    expect(payload.variants.map((variant: any) => variant.stock)).toEqual([0, 0]);
    unsubscribe();
  });
  it('ignores an inventory snapshot belonging to another product', () => {
    renderToStaticMarkup(createElement(ProductForm, { lojaID: 'store', productId: 'product', initialData: initial }));
    harness.inventoryRead({ id: 'another-product', stock: 100, productVariants: [{ id: 'persisted-id', stock: 90 }] });
    expect(harness.form.getValues('stock')).toBe(initial.stock);
    expect(harness.form.getValues('variants')[0].stock).toBe(10);
    expect(harness.fetch).not.toHaveBeenCalled();
  });
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
      expect(payload.stock).toBeUndefined();
      expect(payload.variants[0].stock).toBe(0);
      expect(payload.expectedCatalogVersion).toBe(0);
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
  it('conflict keeps catalog draft and does not navigate or resubmit automatically', async () => {
    harness.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'CATALOG_VERSION_CONFLICT' }) });
    renderToStaticMarkup(createElement(ProductForm, { lojaID: 'store', productId: 'product', initialData: { ...initial, name: 'Rascunho preservado' } }));
    await harness.submit();
    expect(harness.form.getValues('name')).toBe('Rascunho preservado');
    expect(harness.fetch).toHaveBeenCalledTimes(1);
    expect(harness.router.push).not.toHaveBeenCalled();
    expect(harness.toast).toHaveBeenCalled();
  });
});
