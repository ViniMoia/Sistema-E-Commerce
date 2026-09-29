"use client";

import React, { useEffect, useRef, useState } from "react";

const VIDEO_DEFER_MS = 2000;

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;

    const syncPreference = () => {
      const reduceMotion = mediaQuery.matches;
      setPrefersReducedMotion(reduceMotion);
      window.clearTimeout(timer);

      if (reduceMotion) {
        setShouldLoadVideo(false);
        videoRef.current?.pause();
        return;
      }

      timer = window.setTimeout(() => setShouldLoadVideo(true), VIDEO_DEFER_MS);
    };

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => {
      mediaQuery.removeEventListener("change", syncPreference);
      window.clearTimeout(timer);
    };
  }, []);

  const scrollToCatalog = (event: React.MouseEvent) => {
    event.preventDefault();
    document.getElementById("catalogo")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section className="relative flex h-[100dvh] w-full items-center justify-start overflow-hidden bg-black md:h-screen">
      <video
        ref={videoRef}
        src={shouldLoadVideo ? "/videos/hero.mp4" : undefined}
        poster="/videos/hero-poster.jpg"
        autoPlay={shouldLoadVideo && !prefersReducedMotion}
        muted
        playsInline
        preload="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
      />

      <div
        className="pointer-events-none absolute inset-0 z-10 w-full bg-gradient-to-r from-black/80 via-black/35 to-transparent md:w-[58%]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-20 flex w-full max-w-xl flex-col items-start justify-center px-6 sm:px-12 md:pl-16 lg:max-w-2xl lg:pl-24 xl:pl-28">
        <h1 className="mb-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[4rem]">
          <span className="block">ESTÉTICA</span>
          <span className="block text-slate-200">AUTOMOTIVA</span>
          <span className="text-glow block bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            DE ALTA PRECISÃO
          </span>
        </h1>

        <p className="mb-8 max-w-lg text-sm font-light leading-relaxed text-slate-300/90 sm:text-base md:text-lg">
          Formulação de alto padrão desenvolvida para proteção prolongada, brilho profundo e acabamento impecável em cada superfície do seu veículo.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="btn-shimmer group flex cursor-pointer items-center gap-3 rounded-full border border-[#F5BD1E]/40 bg-gradient-to-r from-[#F0B40E] to-[#E5A805] px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-[#010E31] shadow-[0_0_25px_rgba(240,180,14,0.4)] transition-all duration-300 hover:scale-[1.03] hover:from-[#F5BD1E] hover:to-[#F0B40E] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] active:scale-[0.98] sm:text-sm"
          >
            <span>Explorar Catálogo</span>
            <svg className="h-4 w-4 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>

          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-xs font-medium uppercase tracking-widest text-slate-300 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:text-white sm:text-sm"
          >
            Conhecer a Linha
          </a>
        </div>
      </div>
    </section>
  );
}
