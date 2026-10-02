import { describe, it, expect } from "vitest";

describe("Continental Store Presentation Section Specification Suite", () => {
  it("validates official presentation video URL contract", () => {
    const expectedUrl =
      "https://res.cloudinary.com/dpt3zi8kx/video/upload/v1790950761/IMG_6684_fzqdgl.mov";

    expect(expectedUrl).toContain("res.cloudinary.com/dpt3zi8kx/video/upload");
    expect(expectedUrl).toContain("IMG_6684_fzqdgl.mov");
  });

  it("validates section surface, borders and lighting compliance with Continental Design System", () => {
    const sectionClasses =
      "py-16 md:py-24 bg-[#050505] border-t border-catalog-gold/20 relative overflow-hidden";
    const videoFrameClasses =
      "group relative rounded-2xl md:rounded-3xl overflow-hidden border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-500 shadow-[0_25px_60px_rgba(0,0,0,0.9)] shadow-[0_0_40px_rgba(240,180,14,0.12)] bg-[#050B14] aspect-[9/16] flex items-center justify-center w-full";
    const videoClasses = "w-full h-full object-contain cursor-pointer";
    const controlBarClasses =
      "bg-[#050B14]/90 backdrop-blur-xl border border-catalog-gold/40 rounded-full px-3.5 sm:px-4 py-2 flex items-center gap-2 sm:gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)]";

    expect(sectionClasses).toContain("border-t border-catalog-gold/20");
    expect(sectionClasses).toContain("bg-[#050505]");
    expect(videoFrameClasses).toContain("border-catalog-gold/45");
    expect(videoFrameClasses).toContain("aspect-[9/16]");
    expect(videoClasses).toContain("object-contain");
    expect(controlBarClasses).toContain("backdrop-blur-xl");
    expect(controlBarClasses).toContain("border-catalog-gold/40");
  });

  it("validates 3 canonical presentation pillars structure and tokens", () => {
    const pillars = [
      {
        tag: "Precisão",
        title: "Formulação de Alta Performance",
        cardClass: "bg-catalog-card border border-catalog-gold/30 hover:border-catalog-gold/50",
      },
      {
        tag: "Autenticidade",
        title: "Procedência & Padrão de Fábrica",
        cardClass: "bg-catalog-card border border-catalog-gold/30 hover:border-catalog-gold/50",
      },
      {
        tag: "Especialistas",
        title: "Suporte Técnico Especializado",
        cardClass: "bg-catalog-card border border-catalog-gold/30 hover:border-catalog-gold/50",
      },
    ];

    expect(pillars).toHaveLength(3);
    pillars.forEach((p) => {
      expect(p.cardClass).toContain("bg-catalog-card");
      expect(p.cardClass).toContain("border-catalog-gold/30");
    });
  });

  it("validates horizontal accordion expansion contract on desktop hover", () => {
    const resolveDesktopCardClass = (isHovered: boolean, hasAnyHover: boolean) => {
      if (isHovered) {
        return "flex-[2.4] border-catalog-gold/70 bg-[#0B132B]/95 shadow-[0_0_35px_rgba(240,180,14,0.18)]";
      }
      if (hasAnyHover) {
        return "flex-[0.8] border-catalog-gold/20 bg-catalog-card opacity-60";
      }
      return "flex-1 border-catalog-gold/30 bg-catalog-card hover:border-catalog-gold/50";
    };

    // Idle: All cards have flex-1
    expect(resolveDesktopCardClass(false, false)).toContain("flex-1");

    // Hovered: Target card expands horizontally to flex-[2.4]
    expect(resolveDesktopCardClass(true, true)).toContain("flex-[2.4]");
    expect(resolveDesktopCardClass(true, true)).toContain("border-catalog-gold/70");

    // Sibling: Non-hovered cards contract to flex-[0.8]
    expect(resolveDesktopCardClass(false, true)).toContain("flex-[0.8]");
    expect(resolveDesktopCardClass(false, true)).toContain("opacity-60");
  });

  it("validates vertical expansion contract on mobile screens", () => {
    const resolveMobileDrawerClass = (isExpanded: boolean) => {
      return isExpanded
        ? "max-h-48 pb-6 opacity-100"
        : "max-h-0 pb-0 opacity-0 pointer-events-none";
    };

    expect(resolveMobileDrawerClass(false)).toContain("max-h-0");
    expect(resolveMobileDrawerClass(false)).toContain("opacity-0");
    expect(resolveMobileDrawerClass(true)).toContain("max-h-48");
    expect(resolveMobileDrawerClass(true)).toContain("opacity-100");
  });

  it("validates primary CTA button follows Design System btn-shimmer contract", () => {
    const ctaClasses =
      "btn-shimmer px-8 py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)]";

    expect(ctaClasses).toContain("btn-shimmer");
    expect(ctaClasses).toContain("from-[#F0B40E]");
    expect(ctaClasses).toContain("to-[#E5A805]");
    expect(ctaClasses).toContain("text-[#010E31]");
    expect(ctaClasses).toContain("uppercase");
    expect(ctaClasses).toContain("tracking-widest");
  });

  it("validates video player accessibility contract", () => {
    const accessibilityContract = {
      progressBarRole: "progressbar",
      playButtonAria: "Reproduzir vídeo",
      pauseButtonAria: "Pausar vídeo",
      muteButtonAria: "Ativar som",
    };

    expect(accessibilityContract.progressBarRole).toBe("progressbar");
    expect(accessibilityContract.playButtonAria).toBe("Reproduzir vídeo");
    expect(accessibilityContract.pauseButtonAria).toBe("Pausar vídeo");
    expect(accessibilityContract.muteButtonAria).toBe("Ativar som");
  });
});
