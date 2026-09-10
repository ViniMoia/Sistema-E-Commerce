"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const descRef = useRef<HTMLParagraphElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  const hasTriggeredAnimation = useRef(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Trigger natural GSAP emergence animation
  const triggerReveal = () => {
    if (hasTriggeredAnimation.current) return;
    hasTriggeredAnimation.current = true;

    // Dispatch event to smoothly illuminate the Header
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hero-car-illuminated"));
    }

    if (!containerRef.current) return;

    // Natural, cinematic GSAP timeline
    const tl = gsap.timeline({
      defaults: {
        ease: "power3.out",
      },
    });

    // Make container visible
    gsap.set(containerRef.current, { visibility: "visible", opacity: 1 });

    // 1. Badge emergence
    if (badgeRef.current) {
      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: 24, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2 }
      );
    }

    // 2. Heading lines reveal with mask
    if (headingRef.current) {
      const lines = headingRef.current.querySelectorAll(".text-reveal-content");
      if (lines.length > 0) {
        tl.fromTo(
          lines,
          { y: "110%", opacity: 0 },
          { y: "0%", opacity: 1, duration: 1.4, stagger: 0.18 },
          "-=0.9"
        );
      }
    }

    // 3. Auxiliary description text
    if (descRef.current) {
      tl.fromTo(
        descRef.current,
        { opacity: 0, y: 20, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2 },
        "-=0.9"
      );
    }

    // 4. CTA buttons
    if (ctaRef.current) {
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1.0 },
        "-=0.8"
      );
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;

    // Time update listener: studio light illuminates vehicle at ~2.8 seconds
    const handleTimeUpdate = () => {
      if (video.currentTime >= 2.8 && !hasTriggeredAnimation.current) {
        triggerReveal();
      }
    };

    // When reaching the end, pause on the final frame (no loop)
    const handleEnded = () => {
      video.pause();
      if (!hasTriggeredAnimation.current) {
        triggerReveal();
      }
    };

    // When video starts playing
    const handleCanPlay = () => {
      setVideoLoaded(true);
      video.play().catch(() => {
        // Autoplay policy fallback
      });
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("canplay", handleCanPlay);

    // Safety fallback: if video is blocked or takes too long, reveal naturally after 3.5s
    const fallbackTimer = setTimeout(() => {
      if (!hasTriggeredAnimation.current) {
        triggerReveal();
      }
    }, 3800);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("canplay", handleCanPlay);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const scrollToCatalog = (e: React.MouseEvent) => {
    e.preventDefault();
    const catalogElement = document.getElementById("catalogo");
    if (catalogElement) {
      catalogElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative w-full h-[100dvh] md:h-screen overflow-hidden flex items-center justify-start bg-black">
      {/* Background Video */}
      <video
        ref={videoRef}
        src="/videos/hero.mp4"
        poster="/videos/hero-poster.jpg"
        autoPlay
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover object-center z-0 pointer-events-none"
      />

      {/* Sombra Preta Neutra (Opção 3) - Sem matiz/tinta azulada, apenas preto puro e suave para contraste do texto */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-black/80 via-black/35 to-transparent w-full md:w-[58%]" 
        aria-hidden="true"
      />

      {/* Bottom Gradient blending smoothly into the #050505 catalog section below */}
      <div 
        className="absolute bottom-0 inset-x-0 h-36 z-10 pointer-events-none bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" 
        aria-hidden="true"
      />

      {/* Hero Components: Centered on Y axis, Aligned Left on X axis with comfortable margin */}
      <div
        ref={containerRef}
        style={{ visibility: "hidden", opacity: 0 }}
        className="relative z-20 w-full max-w-xl lg:max-w-2xl px-6 sm:px-12 md:pl-16 lg:pl-24 xl:pl-28 flex flex-col items-start justify-center"
      >
        {/* Brand Badge */}
        <div
          ref={badgeRef}
          className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-lg shadow-black/20"
        >
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          <span className="text-[10px] sm:text-xs font-mono tracking-[0.22em] uppercase text-slate-300 font-semibold">
            Sistema Profissional • Continental
          </span>
        </div>

        {/* Hero Title (H1) with text-reveal-wrapper lines */}
        <h1
          ref={headingRef}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-bold tracking-tight text-white leading-[1.08] mb-6"
        >
          <span className="text-reveal-wrapper block">
            <span className="text-reveal-content block">ESTÉTICA</span>
          </span>
          <span className="text-reveal-wrapper block">
            <span className="text-reveal-content block text-slate-200">AUTOMOTIVA</span>
          </span>
          <span className="text-reveal-wrapper block">
            <span className="text-reveal-content block text-glow text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
              DE ALTA PRECISÃO
            </span>
          </span>
        </h1>

        {/* Auxiliary Text */}
        <p
          ref={descRef}
          className="text-sm sm:text-base md:text-lg text-slate-300/90 font-light leading-relaxed max-w-lg mb-8"
        >
          Formulação de alto padrão desenvolvida para proteção prolongada, brilho profundo e acabamento impecável em cada superfície do seu veículo.
        </p>

        {/* Action CTAs */}
        <div ref={ctaRef} className="flex flex-wrap items-center gap-4">
          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="btn-shimmer px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center gap-3 group cursor-pointer border border-[#F5BD1E]/40"
          >
            <span className="relative z-10">Explorar Catálogo</span>
            <svg
              className="w-4 h-4 text-[#010E31] group-hover:translate-y-0.5 transition-transform relative z-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </a>

          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="px-6 py-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs sm:text-sm tracking-widest uppercase border border-white/10 hover:border-white/20 backdrop-blur-md transition-all duration-300 cursor-pointer"
          >
            Conhecer a Linha
          </a>
        </div>
      </div>
    </section>
  );
}
