"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowUp,
  MapPin,
  Phone,
  Clock,
  CreditCard,
  QrCode,
  FileText,
  ShieldCheck,
  Star,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { ContinentalLogo } from "@/components/brand/ContinentalLogo";

const WHATSAPP_URL =
  "https://wa.me/5591981316801?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Continental%20e%20gostaria%20de%20informa%C3%A7%C3%B5es.";

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer
      id="rodape"
      className="border-t border-catalog-gold/30 bg-[#03060C] text-catalog-text relative overflow-hidden pt-16 pb-10"
    >
      {/* Linha de brilho superior em gradiente dourado */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#F0B40E]/60 to-transparent" />

      {/* Halo radial de iluminação técnica dourada */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-64 pointer-events-none opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(240,180,14,0.15) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        {/* Grade Principal com 4 Colunas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 mb-14">
          {/* Coluna 1: Identidade Visual com Logo Oficial (sem nome em texto) */}
          <div className="lg:col-span-4 flex flex-col items-start gap-4">
            {/* Logo Oficial da Loja */}
            <ContinentalLogo
              variant="horizontal"
              className="h-10 sm:h-11 w-auto"
              href="/"
            />

            <p className="text-catalog-muted text-xs sm:text-sm font-light leading-relaxed max-w-sm mt-1">
              Especialistas em produtos de alta performance para detalhamento
              automotivo, vitrificadores cerâmicos e químicos profissionais.
              Formulações de padrão internacional com atendimento técnico direto.
            </p>

            {/* Selo Google 5.0 Estrelas */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-catalog-card border border-catalog-gold/30 mt-1 shadow-sm">
              <div className="flex text-[#F0B40E]">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 fill-current text-[#F0B40E]"
                  />
                ))}
              </div>
              <span className="text-white font-bold text-xs">5.0</span>
              <span className="text-[10px] text-catalog-gold font-mono uppercase tracking-wider border-l border-catalog-gold/30 pl-2">
                95 avaliações
              </span>
            </div>
          </div>

          {/* Coluna 2: Navegação & Acesso Rápido */}
          <div className="lg:col-span-2">
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-catalog-gold uppercase mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-catalog-gold rounded-full" />
              Navegação
            </span>
            <ul className="space-y-3 text-xs sm:text-sm font-light">
              <li>
                <a
                  href="#catalogo"
                  onClick={(e) => handleSmoothScroll(e, "catalogo")}
                  className="text-catalog-muted hover:text-white transition-colors duration-200 flex items-center gap-1.5 group cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-catalog-gold/60 group-hover:text-catalog-gold group-hover:translate-x-1 transition-all" />
                  <span>Catálogo de Produtos</span>
                </a>
              </li>
              <li>
                <a
                  href="#apresentacao"
                  onClick={(e) => handleSmoothScroll(e, "apresentacao")}
                  className="text-catalog-muted hover:text-white transition-colors duration-200 flex items-center gap-1.5 group cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-catalog-gold/60 group-hover:text-catalog-gold group-hover:translate-x-1 transition-all" />
                  <span>Vídeo da Loja</span>
                </a>
              </li>
              <li>
                <a
                  href="#localizacao"
                  onClick={(e) => handleSmoothScroll(e, "localizacao")}
                  className="text-catalog-muted hover:text-white transition-colors duration-200 flex items-center gap-1.5 group cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-catalog-gold/60 group-hover:text-catalog-gold group-hover:translate-x-1 transition-all" />
                  <span>Loja Física & Mapa</span>
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-catalog-muted hover:text-white transition-colors duration-200 flex items-center gap-1.5 group"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-catalog-gold/60 group-hover:text-catalog-gold group-hover:translate-x-1 transition-all" />
                  <span>Minha Conta</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Atendimento & Estúdio Físico */}
          <div className="lg:col-span-3">
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-catalog-gold uppercase mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-catalog-gold rounded-full" />
              Loja Física
            </span>

            <div className="space-y-3.5 text-xs sm:text-sm font-light">
              {/* Endereço */}
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-catalog-gold shrink-0 mt-0.5" />
                <span className="text-catalog-muted leading-snug">
                  Tv. Sn-23 - Coqueiro, Ananindeua - PA, CEP 67140-674
                </span>
              </div>

              {/* Horários */}
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-catalog-gold shrink-0 mt-0.5" />
                <div className="text-catalog-muted space-y-0.5">
                  <p>Segunda a Sexta: 09h às 18h</p>
                  <p>Sábado: 09h às 13h</p>
                </div>
              </div>

              {/* Contato WhatsApp */}
              <div className="pt-2">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl border border-catalog-gold/45 hover:border-catalog-gold bg-catalog-gold/10 hover:bg-catalog-gold/20 text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-catalog-gold" />
                  <span>(91) 98131-6801</span>
                </a>
              </div>
            </div>
          </div>

          {/* Coluna 4: Meios de Pagamento & Segurança */}
          <div className="lg:col-span-3">
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-catalog-gold uppercase mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-catalog-gold rounded-full" />
              Pagamento & Segurança
            </span>

            {/* Pílulas de Formas de Pagamento */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-catalog-card border border-catalog-gold/25 text-xs text-neutral-300">
                <QrCode className="w-4 h-4 text-catalog-gold shrink-0" />
                <span className="font-mono text-[11px]">PIX Instantâneo</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-catalog-card border border-catalog-gold/25 text-xs text-neutral-300">
                <CreditCard className="w-4 h-4 text-catalog-gold shrink-0" />
                <span className="font-mono text-[11px]">Cartão até 12x</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-catalog-card border border-catalog-gold/25 text-xs text-neutral-300 col-span-2">
                <FileText className="w-4 h-4 text-catalog-gold shrink-0" />
                <span className="font-mono text-[11px]">Boleto Bancário</span>
              </div>
            </div>

            {/* Selos de Segurança */}
            <div className="flex items-center gap-2 text-xs text-catalog-muted bg-catalog-gold/5 border border-catalog-gold/20 rounded-xl p-2.5">
              <ShieldCheck className="w-5 h-5 text-catalog-gold shrink-0" />
              <span className="text-[11px] leading-tight">
                Ambiente Criptografado & Checkout 100% Seguro (SSL)
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Footer (Barra Inferior) */}
        <div className="border-t border-catalog-gold/20 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-catalog-muted">
          <div>
            <span>© 2026. Todos os direitos reservados.</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Desenvolvido por</span>
            <span className="text-white font-bold tracking-wider">Vancer.</span>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-catalog-gold/30 hover:border-catalog-gold hover:bg-catalog-gold/10 text-catalog-gold hover:text-white transition-all duration-300 cursor-pointer text-xs"
            aria-label="Voltar ao topo da página"
          >
            <span>Voltar ao topo</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
