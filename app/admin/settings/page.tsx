'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    name: string;
    slug: string;
    description: string;
    coverImageUrl: string;
    pixKey: string | null;
    pixKeyType: string | null;
    whatsappNumber: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    customDomain: string | null;
  } | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndSettings();
  }, []);

  const loadUserAndSettings = async () => {
    try {
      const res = await fetch('/api/loja/settings');
      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          setErrorMessage('Usuário não autorizado ou não associado a nenhuma loja');
        } else {
          setErrorMessage('Erro ao carregar configurações');
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      setSettings(data || {
        name: '',
        slug: '',
        description: '',
        coverImageUrl: '',
        pixKey: null,
        pixKeyType: null,
        whatsappNumber: null,
        primaryColor: '#DDAF02',
        secondaryColor: '#050505',
        customDomain: null
      });
      setLoading(false);
    } catch (err) {
      console.error('[ADMIN_SETTINGS_LOAD_ERROR]', err);
      setErrorMessage('Erro ao carregar configurações');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/loja/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          slug: settings.slug,
          description: settings.description,
          coverImageUrl: settings.coverImageUrl,
          pixKey: settings.pixKey === '' ? null : settings.pixKey,
          pixKeyType: settings.pixKeyType === '' ? null : settings.pixKeyType,
          whatsappNumber: settings.whatsappNumber === '' ? null : settings.whatsappNumber,
          primaryColor: settings.primaryColor === '' ? null : settings.primaryColor,
          secondaryColor: settings.secondaryColor === '' ? null : settings.secondaryColor,
          customDomain: settings.customDomain === '' ? null : settings.customDomain
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSuccessMessage('Configurações atualizadas com sucesso!');
        setSettings(updated);
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMessage(errData?.error || 'Falha ao atualizar configurações');
      }
    } catch (err) {
      console.error('[ADMIN_SETTINGS_UPDATE_ERROR]', err);
      setErrorMessage('Erro ao atualizar configurações');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleClearSettings = async () => {
    if (!confirm('Deseja realmente apagar os dados de Pix e contato de sua loja? (Nome, slug e tema serão mantidos)')) return;
    
    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/loja/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          pixKey: null,
          pixKeyType: null,
          whatsappNumber: null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSuccessMessage('Configurações de contato apagadas com sucesso!');
        setSettings(updated);
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMessage(errorData?.error || 'Falha ao apagar configurações');
      }
    } catch (err) {
      console.error('[ADMIN_SETTINGS_CLEAR_ERROR]', err);
      setErrorMessage('Erro ao apagar configurações');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-[#DDAF02]/50 border-t-[#DDAF02] rounded-full animate-spin" />
          <p className="mt-3 text-xs text-neutral-400">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-red-500">{errorMessage}</p>
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/admin'}
            className="mt-4"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Gemini-inspired header with subtle animations */}
      <header className="fixed inset-0 z-[0] pointer-events-none">
        <div className="absolute inset-0">
          <div className="relative h-full bg-[radial-gradient(800px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(255,255,255,0.03),transparent_40%)]" 
               onMouseMove={e => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = e.clientX - rect.left;
                 const y = e.clientY - rect.top;
                 (e.currentTarget as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
                 (e.currentTarget as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
               }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.01),rgba(255,255,255,0))] 
                                 pointer-events-none" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-[10] min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pb-12">
        {!settings && (
          <div className="text-center">
            <p className="text-yellow-500">Carregando configurações da loja...</p>
          </div>
        )}
        {settings && (
          <form onSubmit={handleSubmit} className="w-full max-w-[600px] space-y-6 bg-zinc-950/80 p-8 rounded-2xl border border-white/5 backdrop-blur-md">

            {/* Title */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                Configurações da Loja
              </h2>
              <p className="text-sm text-neutral-400">
                Personalize a identidade de marca, visual, contatos e chaves PIX de sua loja
              </p>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
                <p className="text-primary font-medium">{successMessage}</p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <p className="text-red-400 font-medium">{errorMessage}</p>
              </div>
            )}

            {/* --- SEÇÃO IDENTIDADE --- */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">Identidade</h3>
              
              {/* Nome da Loja */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Nome da Loja
                </label>
                <input
                  type="text"
                  value={settings.name ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, name: e.target.value} : settings)}
                  placeholder="Nome de sua empresa"
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  required
                  disabled={submitLoading}
                />
              </div>

              {/* Slug da Loja */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Slug (Subdomínio)
                </label>
                <input
                  type="text"
                  value={settings.slug ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')} : settings)}
                  placeholder="ex: minha-loja"
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  required
                  disabled={submitLoading}
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Descrição (SEO)
                </label>
                <textarea
                  value={settings.description ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, description: e.target.value} : settings)}
                  placeholder="Uma breve descrição sobre sua loja para as buscas do Google"
                  rows={2}
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  disabled={submitLoading}
                />
              </div>

              {/* URL da Logomarca */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Logotipo / URL da Imagem
                </label>
                <input
                  type="text"
                  value={settings.coverImageUrl ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, coverImageUrl: e.target.value} : settings)}
                  placeholder="Link público para imagem da logomarca"
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  disabled={submitLoading}
                />
              </div>
            </div>

            {/* --- SEÇÃO ESTILO & DESIGN --- */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">Estilo & Layout</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Cor Primária */}
                <div className="space-y-1">
                  <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                    Cor Primária (Hex)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor || '#DDAF02'}
                      onChange={(e) => setSettings(prev => prev ? {...prev, primaryColor: e.target.value} : settings)}
                      className="h-12 w-12 rounded-lg bg-[#050505]/50 border border-neutral-700/50 p-1 cursor-pointer"
                      disabled={submitLoading}
                    />
                    <input
                      type="text"
                      value={settings.primaryColor || '#DDAF02'}
                      onChange={(e) => setSettings(prev => prev ? {...prev, primaryColor: e.target.value} : settings)}
                      placeholder="#HEX"
                      maxLength={7}
                      className={`flex-1 px-3 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                               text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                               focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                               ${submitLoading ? 'opacity-70' : ''}`}
                      disabled={submitLoading}
                    />
                  </div>
                </div>

                {/* Cor Secundária */}
                <div className="space-y-1">
                  <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                    Cor Secundária (Fundo)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor || '#050505'}
                      onChange={(e) => setSettings(prev => prev ? {...prev, secondaryColor: e.target.value} : settings)}
                      className="h-12 w-12 rounded-lg bg-[#050505]/50 border border-neutral-700/50 p-1 cursor-pointer"
                      disabled={submitLoading}
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor || '#050505'}
                      onChange={(e) => setSettings(prev => prev ? {...prev, secondaryColor: e.target.value} : settings)}
                      placeholder="#HEX"
                      maxLength={7}
                      className={`flex-1 px-3 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                               text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                               focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                               ${submitLoading ? 'opacity-70' : ''}`}
                      disabled={submitLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Domínio Personalizado */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Domínio Customizado
                </label>
                <input
                  type="text"
                  value={settings.customDomain ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, customDomain: e.target.value} : settings)}
                  placeholder="ex: www.minhaloja.com.br"
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  disabled={submitLoading}
                />
              </div>
            </div>

            {/* --- SEÇÃO PAGAMENTO --- */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">Recebimento PIX</h3>
              
              {/* PIX Key Section */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Chave PIX
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={settings.pixKey ?? ''}
                    onChange={(e) => setSettings(prev => prev ? {...prev, pixKey: e.target.value} : settings)}
                    placeholder="Digite sua chave PIX"
                    className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                             text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                             focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                             ${submitLoading ? 'opacity-70' : ''}`}
                    disabled={submitLoading}
                  />
                  {settings.pixKey && (
                    <button
                      type="button"
                      onClick={() => setSettings(prev => prev ? {...prev, pixKey: ''} : settings)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center 
                               text-neutral-400 hover:text-primary transition-colors"
                      disabled={submitLoading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* PIX Key Type Section */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Tipo da Chave PIX
                </label>
                <select
                  value={settings.pixKeyType ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, pixKeyType: e.target.value} : settings)}
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  disabled={submitLoading}
                >
                  <option value="">Selecione o tipo</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="TELEFONE">Telefone</option>
                  <option value="ALEATORIA">Chave Aleatória</option>
                </select>
              </div>
            </div>

            {/* --- SEÇÃO CONTATO --- */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">Contato</h3>
              
              {/* WhatsApp Number Section */}
              <div className="space-y-1">
                <label className="text-[10px] text-primary font-mono tracking-[0.25em] uppercase block">
                  Número do WhatsApp
                </label>
                <input
                  type="tel"
                  value={settings.whatsappNumber ?? ''}
                  onChange={(e) => setSettings(prev => prev ? {...prev, whatsappNumber: e.target.value} : settings)}
                  placeholder="(DDD) 9XXXX-XXXX"
                  className={`w-full px-4 py-3 bg-[#050505]/50 border border-neutral-700/50 rounded-xl 
                           text-neutral-100 placeholder:text-neutral-400 focus:outline-none 
                           focus:ring-2 focus:ring-primary/55 focus:border-primary transition-all
                           ${submitLoading ? 'opacity-70' : ''}`}
                  disabled={submitLoading}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <Button
                type="submit"
                disabled={submitLoading || !settings}
                className="w-full bg-primary hover:opacity-90 text-zinc-950 text-base py-6 font-semibold 
                         shadow-[0_0_20px_rgba(221,175,2,0.3)] transition-all flex items-center justify-center group"
              >
                {submitLoading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" stroke="currentColor">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="none" d="M4 12a8 8 0 018-8v8z" strokeWidth="4"></path>
                    </svg>
                    Atualizando...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21.02L12 17.77L5.82 21.02l-5-4.87L6.91 9.27l9.19-6.26Z"></path>
                    </svg>
                    Salvar
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={handleClearSettings}
                disabled={submitLoading || !settings || (!settings.pixKey && !settings.whatsappNumber)}
                variant="outline"
                className="w-full border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 text-base py-6 font-semibold transition-all flex items-center justify-center group bg-transparent"
              >
                {submitLoading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" stroke="currentColor">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="none" d="M4 12a8 8 0 018-8v8z" strokeWidth="4"></path>
                    </svg>
                    Limpando...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Apagar Contatos
                  </>
                )}
              </Button>
            </div>

            {/* Back to Dashboard */}
            <div className="mt-6 text-center">
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/admin'}
                className="text-neutral-400 hover:text-white"
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-[10] border-t border-white/10 py-6">
        <div className="container mx-auto px-6 text-center text-sm text-neutral-500">
          © 2026 Painel Admin. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}