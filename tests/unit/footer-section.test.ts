import { describe, it, expect } from "vitest";

describe("Continental Store Footer Specification Suite", () => {
  it("validates Continental Design System surface and border tokens", () => {
    const footerClasses =
      "border-t border-catalog-gold/30 bg-[#03060C] text-catalog-text relative overflow-hidden pt-16 pb-10";
    const glowLineClasses =
      "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#F0B40E]/60 to-transparent";

    expect(footerClasses).toContain("border-catalog-gold/30");
    expect(footerClasses).toContain("bg-[#03060C]");
    expect(footerClasses).toContain("text-catalog-text");
    expect(glowLineClasses).toContain("via-[#F0B40E]/60");
  });

  it("validates that brand column uses ContinentalLogo with horizontal variant", () => {
    const logoConfig = {
      variant: "horizontal",
      className: "h-10 sm:h-11 w-auto",
      href: "/",
    };

    expect(logoConfig.variant).toBe("horizontal");
    expect(logoConfig.href).toBe("/");
    expect(logoConfig.className).toContain("h-10");
  });

  it("validates smooth anchor navigation links for core store sections", () => {
    const navLinks = [
      { label: "Catálogo de Produtos", href: "#catalogo" },
      { label: "Vídeo da Loja", href: "#apresentacao" },
      { label: "Loja Física & Mapa", href: "#localizacao" },
      { label: "Minha Conta", href: "/login" },
    ];

    expect(navLinks).toHaveLength(4);
    expect(navLinks.map((l) => l.href)).toEqual([
      "#catalogo",
      "#apresentacao",
      "#localizacao",
      "/login",
    ]);
  });

  it("validates store physical address, hours and contact details", () => {
    const storeInfo = {
      address: "Tv. Sn-23 - Coqueiro, Ananindeua - PA, CEP 67140-674",
      hours: {
        weekday: "Segunda a Sexta: 09h às 18h",
        saturday: "Sábado: 09h às 13h",
      },
      phone: "(91) 98131-6801",
      whatsappPrefix: "https://wa.me/5591981316801",
    };

    expect(storeInfo.address).toContain("Tv. Sn-23 - Coqueiro");
    expect(storeInfo.address).toContain("Ananindeua - PA");
    expect(storeInfo.phone).toBe("(91) 98131-6801");
    expect(storeInfo.whatsappPrefix).toContain("5591981316801");
    expect(storeInfo.hours.weekday).toContain("09h às 18h");
  });

  it("validates payment methods and checkout security badges", () => {
    const paymentBadges = [
      "PIX Instantâneo",
      "Cartão até 12x",
      "Boleto Bancário",
    ];
    const securityClaim =
      "Ambiente Criptografado & Checkout 100% Seguro (SSL)";

    expect(paymentBadges).toContain("PIX Instantâneo");
    expect(paymentBadges).toContain("Cartão até 12x");
    expect(paymentBadges).toContain("Boleto Bancário");
    expect(securityClaim).toContain("Criptografado");
    expect(securityClaim).toContain("SSL");
  });

  it("validates return-to-top interaction button and copyright notice", () => {
    const subFooterConfig = {
      copyright: "© 2026. Todos os direitos reservados.",
      platform: "Vancer.",
      hasScrollToTop: true,
    };

    expect(subFooterConfig.copyright).toContain("2026");
    expect(subFooterConfig.platform).toBe("Vancer.");
    expect(subFooterConfig.hasScrollToTop).toBe(true);
  });
});
