"use client";

import React, { useEffect, useRef, useState } from "react";

const DESKTOP_VIDEO_URL =
  "https://res.cloudinary.com/dpt3zi8kx/video/upload/v1790881130/Porsche_911_product_film_lighting_20261001155806_s4mbls.mp4";
const MOBILE_VIDEO_URL =
  "https://res.cloudinary.com/dpt3zi8kx/video/upload/v1790795810/Automotive_film_production_guide_1080p_20260930161505_e6suze.mp4";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>();

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setVideoSrc(reducedMotion.matches ? undefined : mobile.matches ? MOBILE_VIDEO_URL : DESKTOP_VIDEO_URL);
    update();
    mobile.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (videoSrc) void video.play().catch(() => { /* The poster and content remain available. */ });
    else { video.pause(); video.load(); }
  }, [videoSrc]);

  const scrollToCatalog = (event: React.MouseEvent) => {
    const catalog = document.getElementById("catalogo");
    if (!catalog) return;
    event.preventDefault();
    catalog.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  return (
    <section className="relative w-full h-[100dvh] md:h-screen overflow-hidden flex items-center justify-start bg-black">
      {/* Background Video (Desktop ou Mobile de acordo com o breakpoint) */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster="/videos/hero-poster.jpg"
        autoPlay
        muted
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
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
        className="relative z-20 w-full max-w-xl lg:max-w-2xl px-6 sm:px-12 md:pl-16 lg:pl-24 xl:pl-28 flex flex-col items-start justify-center"
      >
        {/* Hero Title (H1) with text-reveal-wrapper lines */}
        <h1
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
          className="text-sm sm:text-base md:text-lg text-slate-300/90 font-light leading-relaxed max-w-lg mb-8"
        >
          Formulação de alto padrão desenvolvida para proteção prolongada, brilho profundo e acabamento impecável em cada superfície do seu veículo.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="btn-shimmer px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center cursor-pointer border border-[#F5BD1E]/40"
          >
            <span className="relative z-10">Explorar Catálogo</span>
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
