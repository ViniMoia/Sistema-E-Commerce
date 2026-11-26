'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  DEFAULT_CONTINENTAL_HERO_SLIDES,
  type HeroSlideConfig,
} from '@/lib/validators/hero-slides';

export function HeroSlidesManager() {
  const [slides, setSlides] = useState<HeroSlideConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/loja/hero-slides');
        if (!res.ok) throw new Error('Falha ao carregar painéis da Hero');
        const data = await res.json();
        if (mounted) {
          const loaded = Array.isArray(data.heroSlides) ? data.heroSlides : [];
          setSlides(loaded);
        }
      } catch (err) {
        if (mounted) {
          setFeedback({
            type: 'error',
            message:
              err instanceof Error ? err.message : 'Erro ao carregar painéis',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddSlide = () => {
    if (slides.length >= 10) return;
    setSlides((prev) => [
      ...prev,
      {
        id: `panel-${Date.now()}`,
        order: prev.length,
        active: true,
        kind: 'ART_PANEL',
        desktopImageUrl: '',
        mobileImageUrl: null,
        altText: 'Painel Continental Estética Automotiva',
        productId: null,
        brandSlug: null,
        tagSlug: null,
        overlayMode: 'NONE',
        ctaLabel: 'Explorar Catálogo',
        anchorTarget: '#catalogo',
      },
    ]);
  };

  const handleLoadDefaults = () => {
    setSlides(DEFAULT_CONTINENTAL_HERO_SLIDES);
    setFeedback(null);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((s, idx) => ({ ...s, order: idx }));
    });
  };

  const handleRemove = (index: number) => {
    setSlides((prev) =>
      prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, order: idx }))
    );
  };

  const updateSlide = (index: number, patch: Partial<HeroSlideConfig>) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const normalized = slides.map((s, idx) => ({
        ...s,
        order: idx,
        mobileImageUrl: s.mobileImageUrl?.trim() ? s.mobileImageUrl.trim() : null,
        productId: s.productId?.trim() ? s.productId.trim() : null,
        brandSlug: s.brandSlug?.trim() ? s.brandSlug.trim() : null,
        tagSlug: s.tagSlug?.trim() ? s.tagSlug.trim() : null,
        ctaLabel: s.ctaLabel?.trim() ? s.ctaLabel.trim() : null,
      }));

      const res = await fetch('/api/loja/hero-slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroSlides: normalized }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || 'Verifique as URLs e campos dos painéis antes de salvar.'
        );
      }

      setSlides(Array.isArray(data?.heroSlides) ? data.heroSlides : normalized);
      setFeedback({
        type: 'success',
        message: 'Painéis do carrossel Hero salvos com sucesso!',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Erro ao salvar painéis da Hero',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-continental-display text-white tracking-tight">
              6. Painéis da Hero (Carrossel de Abertura)
            </h2>
            <p className="text-xs text-catalog-muted font-light">
              Gerencie as artes exibidas no carrossel principal da loja usando URLs externas (ex.: Cloudinary).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {slides.length === 0 && !loading && (
            <button
              type="button"
              onClick={handleLoadDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-catalog-gold/40 bg-catalog-gold/10 text-catalog-gold hover:bg-catalog-gold/20 text-xs font-mono font-bold uppercase cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Carregar Painéis Padrão</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleAddSlide}
            disabled={slides.length >= 10}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-catalog-gold/40 bg-[#050B14] text-white hover:border-catalog-gold text-xs font-mono font-bold uppercase cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5 text-catalog-gold" />
            <span>Adicionar Painel</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-mono ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/50 border-red-500/40 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs font-mono text-catalog-muted">
          <Loader2 className="w-4 h-4 animate-spin text-catalog-gold" />
          <span>Carregando painéis...</span>
        </div>
      ) : slides.length === 0 ? (
        <div className="p-6 rounded-xl bg-[#050B14] border border-catalog-gold/20 text-center space-y-2">
          <p className="text-xs font-mono text-slate-300">
            Nenhum painel personalizado salvo no banco. A vitrine exibirá automaticamente os painéis oficiais padrão da Continental.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="p-4 sm:p-5 rounded-xl bg-[#050B14] border border-catalog-gold/25 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-bold text-catalog-gold uppercase">
                    Painel #{idx + 1}
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slide.active}
                      onChange={(e) =>
                        updateSlide(idx, { active: e.target.checked })
                      }
                      className="h-4 w-4 rounded accent-[#DDAF02]"
                    />
                    Ativo
                  </label>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Mover painel para cima"
                    className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === slides.length - 1}
                    aria-label="Mover painel para baixo"
                    className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    aria-label="Remover painel"
                    className="p-1.5 rounded-lg border border-red-500/30 bg-red-950/30 text-red-400 hover:bg-red-900/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                    URL da Arte (Desktop)
                  </label>
                  <input
                    type="url"
                    value={slide.desktopImageUrl}
                    onChange={(e) =>
                      updateSlide(idx, { desktopImageUrl: e.target.value })
                    }
                    placeholder="https://res.cloudinary.com/..."
                    className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                    URL da Arte Mobile (Opcional)
                  </label>
                  <input
                    type="url"
                    value={slide.mobileImageUrl ?? ''}
                    onChange={(e) =>
                      updateSlide(idx, {
                        mobileImageUrl: e.target.value || null,
                      })
                    }
                    placeholder="https://res.cloudinary.com/..."
                    className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                    Descrição Acessível (Alt Text)
                  </label>
                  <input
                    type="text"
                    value={slide.altText}
                    onChange={(e) =>
                      updateSlide(idx, { altText: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                      Tipo de Painel
                    </label>
                    <select
                      value={slide.kind}
                      onChange={(e) =>
                        updateSlide(idx, {
                          kind: e.target.value as HeroSlideConfig['kind'],
                        })
                      }
                      className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                    >
                      <option value="ART_PANEL">Painel de Arte</option>
                      <option value="BRAND_COLLECTION">Filtro de Marca</option>
                      <option value="PRODUCT_ART">Produto Vinculado</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                      Texto do Botão (CTA)
                    </label>
                    <input
                      type="text"
                      value={slide.ctaLabel ?? ''}
                      onChange={(e) =>
                        updateSlide(idx, { ctaLabel: e.target.value || null })
                      }
                      placeholder="Explorar Catálogo"
                      className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                    />
                  </div>
                </div>
              </div>

              {slide.kind === 'BRAND_COLLECTION' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                    Slug da Marca no Catálogo (ex: vonixx, soft99)
                  </label>
                  <input
                    type="text"
                    value={slide.brandSlug ?? ''}
                    onChange={(e) =>
                      updateSlide(idx, { brandSlug: e.target.value || null })
                    }
                    placeholder="vonixx"
                    className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                  />
                </div>
              )}

              {slide.kind === 'PRODUCT_ART' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                      ID do Produto (UUID)
                    </label>
                    <input
                      type="text"
                      value={slide.productId ?? ''}
                      onChange={(e) =>
                        updateSlide(idx, { productId: e.target.value || null })
                      }
                      placeholder="uuid-do-produto"
                      className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-catalog-gold font-semibold">
                      Barra de Preço sobre Painel
                    </label>
                    <select
                      value={slide.overlayMode}
                      onChange={(e) =>
                        updateSlide(idx, {
                          overlayMode: e.target
                            .value as HeroSlideConfig['overlayMode'],
                        })
                      }
                      className="w-full h-10 px-3 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold"
                    >
                      <option value="NONE">Nenhuma (Arte Limpa)</option>
                      <option value="MINIMAL_DOCK">Dock Discreto na Base</option>
                    </select>
                  </div>
                </div>
              )}

              {slide.desktopImageUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-[21/9] max-h-40 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.desktopImageUrl}
                    alt={slide.altText}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider px-6 py-3 shadow-[0_0_20px_rgba(240,180,14,0.25)] hover:shadow-[0_0_30px_rgba(240,180,14,0.45)] transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando Painéis...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar Painéis da Hero</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
