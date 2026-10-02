"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sparkles,
  Award,
  Headphones,
} from "lucide-react";

interface StorePresentationSectionProps {
  videoUrl?: string;
  lojaName?: string;
}

const DEFAULT_VIDEO_URL =
  "https://res.cloudinary.com/dpt3zi8kx/video/upload/v1790950761/IMG_6684_fzqdgl.mov";

const PILLARS = [
  {
    id: "precisao",
    tag: "Precisão",
    title: "Formulação de Alta Performance",
    description:
      "Químicos, vitrificadores cerâmicos e compostos formulados para máxima ancoragem, repelência hidrofóbica e acabamento de alto padrão.",
    icon: Sparkles,
  },
  {
    id: "autenticidade",
    tag: "Autenticidade",
    title: "Procedência & Padrão de Fábrica",
    description:
      "Produtos 100% originais com controle rigoroso de qualidade e armazenamento térmico, assegurando proteção sem agredir as superfícies.",
    icon: Award,
  },
  {
    id: "especialistas",
    tag: "Especialistas",
    title: "Suporte Técnico Especializado",
    description:
      "Orientação direta de especialistas em detalhamento automotivo para escolha correta, diluição ideal e melhores técnicas de aplicação.",
    icon: Headphones,
  },
];

export function StorePresentationSection({
  videoUrl = DEFAULT_VIDEO_URL,
  lojaName = "Continental",
}: StorePresentationSectionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de expansão dos cards (Desktop: Hover horizontal | Mobile: Toque vertical)
  const [hoveredPillar, setHoveredPillar] = useState<number | null>(null);
  const [activeMobilePillar, setActiveMobilePillar] = useState<number | null>(null);

  const toggleMobilePillar = (index: number) => {
    setActiveMobilePillar((prev) => (prev === index ? null : index));
  };

  // Monitorar estado de fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Ocultar controles automaticamente após inatividade durante reprodução
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    resetControlsTimer();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress(dur > 0 ? (cur / dur) * 100 : 0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = newProgress * (videoRef.current.duration || 0);
    videoRef.current.currentTime = newTime;
    setProgress(newProgress * 100);
    resetControlsTimer();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    resetControlsTimer();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const scrollToCatalog = (e: React.MouseEvent) => {
    e.preventDefault();
    const catalogEl = document.getElementById("catalogo");
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <section
      id="apresentacao"
      className="py-16 md:py-24 bg-[#050505] border-t border-catalog-gold/20 relative overflow-hidden"
    >
      {/* Halo de iluminação técnica dourada radial (Design System Continental) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] pointer-events-none opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 50% 10%, rgba(240,180,14,0.12) 0%, rgba(15,23,42,0.05) 50%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        {/* Cabeçalho da Seção */}
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 bg-catalog-gold/5 px-3 py-1.5 rounded-full inline-block mb-4 shadow-[0_0_15px_rgba(240,180,14,0.08)]">
            Apresentação Exclusiva
          </span>

          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-tight">
            Experiência & Alta Precisão Automotiva
          </h2>

          <p className="mt-4 text-sm sm:text-base text-catalog-muted font-light leading-relaxed max-w-2xl mx-auto">
            Conheça o estúdio, os processos e a excelência que definem a linha de
            produtos da {lojaName}. Formulações de padrão internacional
            desenvolvidas para proteção prolongada e brilho incomparável.
          </p>
        </div>

        {/* Moldura Cinematográfica do Vídeo (Proporção e Resolução Original 9:16) */}
        <div className="relative max-w-[340px] sm:max-w-[380px] md:max-w-[400px] mx-auto mb-16 md:mb-20">
          {/* Halo sutil de iluminação técnica ao redor da moldura portrait */}
          <div
            className="absolute -inset-2 bg-gradient-to-b from-[#F0B40E]/20 via-[#B8A06A]/10 to-transparent rounded-[2rem] blur-xl opacity-70 pointer-events-none"
            aria-hidden="true"
          />

          <div
            ref={containerRef}
            onMouseMove={resetControlsTimer}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            className={`group relative rounded-2xl md:rounded-3xl overflow-hidden border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-500 shadow-[0_25px_60px_rgba(0,0,0,0.9)] shadow-[0_0_40px_rgba(240,180,14,0.12)] ${
              isFullscreen ? "bg-black" : "bg-[#050B14]"
            } aspect-[9/16] flex items-center justify-center w-full`}
          >
            {/* Elemento de Vídeo com Resolução e Proporção Original (Preservação 9:16 em Fullscreen) */}
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              muted={isMuted}
              loop
              preload="metadata"
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain cursor-pointer"
            />

            {/* Botão de Play Central Grande (quando pausado ou em hover) */}
            {(!isPlaying || showControls) && (
              <div
                onClick={togglePlay}
                className={`absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 cursor-pointer ${
                  !isPlaying ? "opacity-100" : "opacity-0 hover:opacity-100"
                }`}
              >
                <button
                  type="button"
                  aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] flex items-center justify-center shadow-[0_0_35px_rgba(240,180,14,0.6)] hover:scale-110 active:scale-95 transition-transform duration-300 focus:outline-none"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
                  )}
                </button>
              </div>
            )}

            {/* Barra de Controles Inferior Estilo Glassmorphism (Ajustada para Formato Portrait & Fullscreen) */}
            <div
              className={`absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm sm:max-w-md transition-opacity duration-300 z-20 ${
                showControls || !isPlaying
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="bg-[#050B14]/90 backdrop-blur-xl border border-catalog-gold/40 rounded-full px-3.5 sm:px-4 py-2 flex items-center gap-2 sm:gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                {/* Play / Pause Pequeno */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="text-catalog-gold hover:text-white transition-colors focus:outline-none p-1 cursor-pointer shrink-0"
                  aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>

                {/* Barra de Progresso com Scrubbing */}
                <div
                  onClick={handleSeek}
                  className="flex-1 h-1.5 sm:h-2 bg-white/15 hover:bg-white/25 rounded-full cursor-pointer relative overflow-hidden transition-colors"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso do vídeo"
                >
                  <div
                    className="h-full bg-gradient-to-r from-brand-yellow to-yellow-400 rounded-full transition-all duration-75 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_#F0B40E]" />
                  </div>
                </div>

                {/* Tempo Atual */}
                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-300 select-none shrink-0">
                  {formatTime(currentTime)}
                </span>

                {/* Toggle de Som */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-catalog-gold hover:text-white transition-colors focus:outline-none p-1 cursor-pointer shrink-0"
                  aria-label={isMuted ? "Ativar som" : "Desativar som"}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-catalog-gold hover:text-white transition-colors focus:outline-none p-1 cursor-pointer shrink-0"
                  aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4" />
                  ) : (
                    <Maximize className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── DESKTOP: CARDS COM EXPANSÃO HORIZONTAL (ACCORDION HOVER) ─── */}
        <div className="hidden md:flex md:flex-row gap-6 max-w-5xl mx-auto mb-14 md:mb-16 md:h-[240px] items-stretch">
          {PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            const isHovered = hoveredPillar === index;
            const hasAnyHover = hoveredPillar !== null;

            return (
              <div
                key={pillar.id}
                onMouseEnter={() => setHoveredPillar(index)}
                onMouseLeave={() => setHoveredPillar(null)}
                className={`relative rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden cursor-pointer ${
                  isHovered
                    ? "flex-[2.4] border-catalog-gold/70 bg-[#0B132B]/95 shadow-[0_0_35px_rgba(240,180,14,0.18)]"
                    : hasAnyHover
                    ? "flex-[0.8] border-catalog-gold/20 bg-catalog-card opacity-60"
                    : "flex-1 border-catalog-gold/30 bg-catalog-card hover:border-catalog-gold/50"
                }`}
              >
                {/* 1. Conteúdo de Repouso: Ícone, Etiqueta e Título Rigorosamente Centralizados */}
                <div
                  className={`w-full h-full flex flex-col items-center justify-center text-center p-6 transition-all duration-300 ${
                    isHovered
                      ? "opacity-0 scale-95 pointer-events-none"
                      : "opacity-100 scale-100"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold flex items-center justify-center mb-3.5 shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold mb-2.5 border border-catalog-gold/45 bg-transparent inline-block px-2.5 py-0.5 rounded">
                    {pillar.tag}
                  </span>
                  <h3 className="text-white font-bold text-base sm:text-lg tracking-tight uppercase leading-snug max-w-[200px]">
                    {pillar.title}
                  </h3>
                </div>

                {/* 2. Conteúdo Expandido (Hover): Exibe Exclusivamente o Texto Auxiliar */}
                <div
                  className={`absolute inset-0 p-8 flex flex-col items-center justify-center text-center transition-all duration-500 delay-75 ${
                    isHovered
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-95 pointer-events-none"
                  }`}
                >
                  <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold mb-3 border-b border-catalog-gold/30 pb-1">
                    {pillar.tag}
                  </span>
                  <p className="text-catalog-text font-light text-sm sm:text-base leading-relaxed max-w-md mx-auto">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── MOBILE: CARDS COM EXPANSÃO VERTICAL (TOQUE / ACCORDION) ─── */}
        <div className="flex md:hidden flex-col gap-4 max-w-5xl mx-auto mb-14">
          {PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            const isExpanded = activeMobilePillar === index;

            return (
              <div
                key={pillar.id}
                onClick={() => toggleMobilePillar(index)}
                className={`w-full rounded-2xl border transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden cursor-pointer ${
                  isExpanded
                    ? "border-catalog-gold/70 bg-[#0B132B]/95 shadow-[0_0_25px_rgba(240,180,14,0.15)]"
                    : "border-catalog-gold/30 bg-catalog-card hover:border-catalog-gold/50"
                }`}
              >
                {/* Cabeçalho do Card Mobile: Ícone, Etiqueta e Título Centralizados */}
                <div className="flex flex-col items-center justify-center text-center p-6 select-none">
                  <div className="w-12 h-12 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold flex items-center justify-center mb-3">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold mb-2 border border-catalog-gold/45 bg-transparent inline-block px-2.5 py-0.5 rounded">
                    {pillar.tag}
                  </span>
                  <h3 className="text-white font-bold text-base tracking-tight uppercase leading-snug">
                    {pillar.title}
                  </h3>
                </div>

                {/* Conteúdo com Expansão Vertical: Texto Auxiliar */}
                <div
                  className={`transition-all duration-400 ease-in-out px-6 overflow-hidden ${
                    isExpanded
                      ? "max-h-48 pb-6 opacity-100"
                      : "max-h-0 pb-0 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="pt-3 border-t border-catalog-gold/25 text-center">
                    <p className="text-catalog-muted text-xs sm:text-sm font-light leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botão de Conversão Shimmer para o Catálogo */}
        <div className="text-center">
          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="btn-shimmer px-8 py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] border border-[#F5BD1E]/40 cursor-pointer inline-flex items-center justify-center"
          >
            <span>Explorar Catálogo Completo</span>
          </a>
        </div>
      </div>
    </section>
  );
}
