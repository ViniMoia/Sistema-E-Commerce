import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("contratos web e de acessibilidade (WEB-006 a WEB-013)", () => {
  it("mantém labels, autocomplete, erros associados e radios nativos no checkout", () => {
    const checkout = source("components/checkout/CheckoutForm.tsx");

    for (const id of [
      "checkout-name",
      "checkout-email",
      "checkout-phone",
      "checkout-cpf-cnpj",
      "checkout-postal-code",
      "checkout-address-line1",
      "checkout-cc-number",
      "checkout-cc-name",
      "checkout-cc-exp",
      "checkout-cc-csc",
    ]) {
      expect(checkout).toContain(`htmlFor=\"${id}\"`);
      expect(checkout).toContain(`id=\"${id}\"`);
    }

    expect(checkout).toContain('type="radio"');
    expect(checkout).toContain('name="deliveryType"');
    expect(checkout).toContain('name="freightOption"');
    expect(checkout).toContain('name="paymentMethod"');
    expect(checkout).toContain("aria-invalid=");
    expect(checkout).toContain("checkout-error-summary");
  });

  it("usa dialogs com foco gerenciado e não mantém menu móvel fechado tabulável", () => {
    const menu = source("components/MobileMenu.tsx");
    const brands = source("components/catalog/BrandBottomSheet.tsx");
    const filters = source("components/catalog/CatalogFreeSidebar.tsx");

    expect(menu).toContain("<Sheet open={menuOpen}");
    expect(menu).not.toContain("translate-x-full");
    expect(brands).toContain("<Sheet open={isOpen}");
    expect(filters).toContain("<SheetTrigger asChild>");
    expect(filters).not.toContain("createPortal");
  });

  it("mantém skip link, foco visível e política de movimento reduzido", () => {
    const layout = source("app/layout.tsx");
    const css = source("app/globals.css");
    const hero = source("components/home/HeroVideo.tsx");

    expect(layout).toContain('href="#main-content"');
    expect(css).toContain(".skip-link:focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(hero).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(hero).toContain("autoPlay={shouldLoadVideo && !prefersReducedMotion}");
    expect(hero).toContain('preload="none"');
  });

  it("remove unsafe-eval da CSP de produção e mantém compatibilidade de desenvolvimento", () => {
    const { buildContentSecurityPolicy } = require(resolve(process.cwd(), "lib/csp.js"));
    const production = buildContentSecurityPolicy("production");
    const development = buildContentSecurityPolicy("development");

    expect(production).not.toContain("'unsafe-eval'");
    expect(production).toContain("object-src 'none'");
    expect(development).toContain("'unsafe-eval'");
  });

  it("mantém confirmação de entrega em dialog com foco gerenciado", () => {
    const orderHistory = source("app/profile/components/OrderHistoryList.tsx");
    expect(orderHistory).toContain("<Dialog");
    expect(orderHistory).toContain("<DialogContent");
    expect(orderHistory).toContain("<DialogDescription");
    expect(orderHistory).not.toContain('className="fixed inset-0 z-50');
  });
});
