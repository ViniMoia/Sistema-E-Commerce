"use client";

import React from "react";
import {
  MapPin,
  Clock,
  Phone,
  Navigation,
  Star,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

interface StoreLocationSectionProps {
  lojaName?: string;
}

const GOOGLE_MAPS_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.7080553251067!2d-48.4017027241259!3d-1.351712935702998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92a461f5ee7ec1f3%3A0xb1a7354db7a21f83!2sCONTINENTAL%20PRODUTOS%20EST%C3%89TICOS%20AUTOMOTIVOS%20-%20VONIXX%20-%20CADILLAC%20-%20MAGIL%20CLEAN%20-%20SGT%20-%20CENTRAL%20SUL!5e0!3m2!1spt-BR!2sbr!4v1790961690270!5m2!1spt-BR!2sbr";

const GOOGLE_MAPS_ROUTE_URL =
  "https://www.google.com/maps/dir/?api=1&destination=CONTINENTAL+PRODUTOS+EST%C3%89TICOS+AUTOMOTIVOS+-+VONIXX+-+CADILLAC+-+MAGIL+CLEAN+-+SGT+-+CENTRAL+SUL+Ananindeua+PA";

const WAZE_ROUTE_URL =
  "https://waze.com/ul?ll=-1.3517129,-48.4017027&navigate=yes";

const WHATSAPP_URL =
  "https://wa.me/5591981316801?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Continental%20e%20gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20os%20produtos%20e%20atendimento%20na%20loja%20f%C3%ADsica.";

export function StoreLocationSection({
  lojaName = "Continental",
}: StoreLocationSectionProps) {
  return (
    <section
      id="localizacao"
      className="py-16 md:py-24 bg-[#050505] border-t border-catalog-gold/20 relative overflow-hidden"
    >
      {/* Halo de iluminação técnica dourada radial (Design System Continental) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] pointer-events-none opacity-35 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(240,180,14,0.12) 0%, rgba(15,23,42,0.05) 50%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        {/* Cabeçalho da Seção */}
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 bg-catalog-gold/5 px-3 py-1.5 rounded-full inline-block mb-4 shadow-[0_0_15px_rgba(240,180,14,0.08)]">
            Loja Física & Atendimento
          </span>

          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-tight">
            Venha Conhecer Nosso Estúdio & Loja
          </h2>

          <p className="mt-4 text-sm sm:text-base text-catalog-muted font-light leading-relaxed max-w-2xl mx-auto">
            Atendimento técnico especializado, estoque a pronta entrega das
            maiores marcas de estética automotiva do mundo e suporte direto de
            profissionais em Ananindeua.
          </p>
        </div>

        {/* Grade Principal: Cards Técnicos (Esquerda) + Mapa Cinematográfico (Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch max-w-6xl mx-auto">
          {/* Coluna Esquerda: Informações Técnicas de Atendimento */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5">
            {/* Card 1: Endereço Oficial */}
            <div className="bg-catalog-card border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-300 rounded-2xl p-6 shadow-sm group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold mb-1.5 block">
                    Endereço Oficial
                  </span>
                  <h3 className="text-white font-bold text-base sm:text-lg leading-snug mb-1">
                    Tv. Sn-23 - Coqueiro
                  </h3>
                  <p className="text-catalog-muted text-xs sm:text-sm font-light leading-relaxed">
                    Ananindeua - PA, CEP 67140-674
                  </p>
                  <p className="text-neutral-400 text-xs mt-1">
                    Próximo aos principais acessos da Região Metropolitana
                  </p>
                </div>
              </div>

              {/* Botões de Rota Rápida */}
              <div className="grid grid-cols-2 gap-2.5 mt-5 pt-4 border-t border-catalog-gold/25">
                <a
                  href={GOOGLE_MAPS_ROUTE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-shimmer flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-[11px] uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer text-center"
                >
                  <Navigation className="w-3.5 h-3.5 shrink-0" />
                  <span>Google Maps</span>
                </a>
                <a
                  href={WAZE_ROUTE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-catalog-gold/45 hover:border-catalog-gold hover:bg-catalog-gold/10 text-catalog-text text-[11px] font-bold uppercase tracking-wider transition-all duration-300 text-center cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-catalog-gold shrink-0" />
                  <span>Waze</span>
                </a>
              </div>
            </div>

            {/* Card 2: Horários de Atendimento */}
            <div className="bg-catalog-card border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-300 rounded-2xl p-6 shadow-sm group">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold mb-1.5 block">
                    Horários de Atendimento
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-400 text-xs font-mono font-medium">
                      Atendimento Ativo
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs sm:text-sm font-light">
                <div className="flex items-center justify-between py-1.5 border-b border-catalog-gold/20">
                  <span className="text-catalog-muted">Segunda a Sexta</span>
                  <span className="text-white font-mono font-semibold">
                    09:00 às 18:00
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-catalog-gold/20">
                  <span className="text-catalog-muted">Sábado</span>
                  <span className="text-white font-mono font-semibold">
                    09:00 às 13:00
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-catalog-muted">Domingo & Feriados</span>
                  <span className="text-neutral-500 font-mono">Fechado</span>
                </div>
              </div>
            </div>

            {/* Card 3: WhatsApp & Prova Social 5.0 */}
            <div className="bg-catalog-card border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-300 rounded-2xl p-6 shadow-sm group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex text-[#F0B40E]">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-current text-[#F0B40E]"
                      />
                    ))}
                  </div>
                  <span className="text-white font-bold text-sm">5.0</span>
                </div>
                <span className="text-[10px] text-catalog-gold font-mono uppercase tracking-wider border border-catalog-gold/30 px-2 py-0.5 rounded">
                  95 avaliações
                </span>
              </div>

              <p className="text-xs text-catalog-muted leading-relaxed mb-4">
                Referência em estética automotiva profissional. Fale direto com
                nossos especialistas no balcão ou via WhatsApp:
              </p>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-catalog-gold/45 hover:border-catalog-gold bg-catalog-gold/10 hover:bg-catalog-gold/20 text-white font-bold text-xs sm:text-sm tracking-wide uppercase transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(240,180,14,0.15)] cursor-pointer"
              >
                <Phone className="w-4 h-4 text-catalog-gold" />
                <span>(91) 98131-6801</span>
                <span className="text-[10px] text-emerald-400 font-mono lowercase ml-1">
                  (whatsapp)
                </span>
              </a>
            </div>
          </div>

          {/* Coluna Direita: Moldura Cinematográfica do Google Maps */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-catalog-gold/45 hover:border-catalog-gold/70 transition-all duration-500 shadow-[0_20px_60px_rgba(0,0,0,0.85)] shadow-[0_0_40px_rgba(240,180,14,0.10)] bg-catalog-card h-[450px] sm:h-[520px] lg:h-full min-h-[460px] flex items-center justify-center group">
              {/* Iframe Interativo Oficial do Google Maps */}
              <iframe
                src={GOOGLE_MAPS_EMBED_URL}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Localização da Continental Produtos Estéticos Automotivos no Google Maps"
                className="w-full h-full grayscale-[15%] contrast-[105%] group-hover:grayscale-0 transition-all duration-500"
              />

              {/* Tag Flutuante Glassmorphism sobre o Mapa */}
              <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-xs bg-[#050B14]/90 backdrop-blur-xl border border-catalog-gold/45 rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-none">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F0B40E] shadow-[0_0_8px_#F0B40E] shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-xs uppercase tracking-tight">
                      {lojaName.includes("PRODUTOS ESTÉTICOS") || lojaName.includes("Produtos Estéticos")
                        ? lojaName
                        : `${lojaName} Produtos Estéticos`}
                    </h4>
                    <p className="text-[11px] text-catalog-muted leading-tight">
                      Ananindeua - Pará
                    </p>
                  </div>
                </div>
              </div>

              {/* Botão Flutuante de Abrir no Google Maps */}
              <div className="absolute bottom-4 right-4">
                <a
                  href={GOOGLE_MAPS_ROUTE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-2 px-3.5 rounded-full bg-[#050B14]/90 hover:bg-[#050B14] backdrop-blur-xl border border-catalog-gold/45 hover:border-catalog-gold text-white text-[11px] font-mono tracking-wider transition-all duration-300 shadow-lg cursor-pointer"
                >
                  <span>Ampliar no Maps</span>
                  <ExternalLink className="w-3.5 h-3.5 text-catalog-gold" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
