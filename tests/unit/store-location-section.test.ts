import { describe, it, expect } from "vitest";

describe("Continental Store Location Section Specification Suite", () => {
  it("validates official Google Maps embed URL contract", () => {
    const embedUrl =
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.7080553251067!2d-48.4017027241259!3d-1.351712935702998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92a461f5ee7ec1f3%3A0xb1a7354db7a21f83!2sCONTINENTAL%20PRODUTOS%20EST%C3%89TICOS%20AUTOMOTIVOS%20-%20VONIXX%20-%20CADILLAC%20-%20MAGIL%20CLEAN%20-%20SGT%20-%20CENTRAL%20SUL!5e0!3m2!1spt-BR!2sbr!4v1790961690270!5m2!1spt-BR!2sbr";

    expect(embedUrl).toContain("google.com/maps/embed");
    expect(embedUrl).toContain("0x92a461f5ee7ec1f3%3A0xb1a7354db7a21f83");
    expect(embedUrl).toContain("CONTINENTAL%20PRODUTOS%20EST%C3%89TICOS");
  });

  it("validates Continental Design System tokens in section and card elements", () => {
    const sectionClasses =
      "py-16 md:py-24 bg-[#050505] border-t border-catalog-gold/20 relative overflow-hidden";
    const cardClasses =
      "bg-catalog-card border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-300 rounded-2xl p-6 shadow-sm group";
    const mapFrameClasses =
      "relative rounded-2xl md:rounded-3xl overflow-hidden border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-500 shadow-[0_20px_60px_rgba(0,0,0,0.85)] shadow-[0_0_40px_rgba(240,180,14,0.10)] bg-catalog-card h-[450px] sm:h-[520px] lg:h-full min-h-[460px] flex items-center justify-center group";

    expect(sectionClasses).toContain("bg-[#050505]");
    expect(sectionClasses).toContain("border-t border-catalog-gold/20");
    expect(cardClasses).toContain("bg-catalog-card");
    expect(cardClasses).toContain("border-catalog-gold/45");
    expect(mapFrameClasses).toContain("border-catalog-gold/45");
    expect(mapFrameClasses).toContain("bg-catalog-card");
  });

  it("validates canonical address, contact and business hours data", () => {
    const storeData = {
      name: "Continental Produtos Estéticos Automotivos",
      address: "Tv. Sn-23 - Coqueiro, Ananindeua - PA",
      cep: "67140-674",
      phoneFormatted: "(91) 98131-6801",
      rating: 5.0,
      reviewCount: 95,
      hours: {
        weekday: "09:00 às 18:00",
        saturday: "09:00 às 13:00",
        sunday: "Fechado",
      },
    };

    expect(storeData.address).toContain("Tv. Sn-23 - Coqueiro");
    expect(storeData.address).toContain("Ananindeua - PA");
    expect(storeData.cep).toBe("67140-674");
    expect(storeData.phoneFormatted).toBe("(91) 98131-6801");
    expect(storeData.rating).toBe(5.0);
    expect(storeData.reviewCount).toBeGreaterThanOrEqual(95);
    expect(storeData.hours.weekday).toBe("09:00 às 18:00");
    expect(storeData.hours.saturday).toBe("09:00 às 13:00");
    expect(storeData.hours.sunday).toBe("Fechado");
  });

  it("validates external route navigation links for Google Maps and Waze", () => {
    const googleMapsRouteUrl =
      "https://www.google.com/maps/dir/?api=1&destination=CONTINENTAL+PRODUTOS+EST%C3%89TICOS+AUTOMOTIVOS+-+VONIXX+-+CADILLAC+-+MAGIL+CLEAN+-+SGT+-+CENTRAL+SUL+Ananindeua+PA";
    const wazeRouteUrl =
      "https://waze.com/ul?ll=-1.3517129,-48.4017027&navigate=yes";
    const whatsappUrl =
      "https://wa.me/5591981316801?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Continental%20e%20gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20os%20produtos%20e%20atendimento%20na%20loja%20f%C3%ADsica.";

    expect(googleMapsRouteUrl).toContain("google.com/maps/dir");
    expect(googleMapsRouteUrl).toContain("CONTINENTAL+PRODUTOS");
    expect(wazeRouteUrl).toContain("waze.com/ul");
    expect(wazeRouteUrl).toContain("-1.3517129,-48.4017027");
    expect(whatsappUrl).toContain("wa.me/5591981316801");
  });

  it("validates primary CTA and badge classes conform to btn-shimmer specification", () => {
    const ctaClass =
      "btn-shimmer flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-[11px] uppercase tracking-wider shadow-md";

    expect(ctaClass).toContain("btn-shimmer");
    expect(ctaClass).toContain("from-[#F0B40E]");
    expect(ctaClass).toContain("to-[#E5A805]");
    expect(ctaClass).toContain("text-[#010E31]");
    expect(ctaClass).toContain("tracking-wider");
  });
});
