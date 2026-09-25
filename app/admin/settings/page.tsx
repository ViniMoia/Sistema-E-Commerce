'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  QrCode,
  Phone,
  Truck,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Clock,
  Store,
  ShieldCheck,
  Globe
} from 'lucide-react';

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
    // Frete
    originCep: string | null;
    originState: string | null;
    originCity: string | null;
    originDistrict: string | null;
    originStreet: string | null;
    originNumber: string | null;
    originComplement: string | null;
    enableCorreios: boolean;
    correiosContractCode: string | null;
    correiosPassword: string | null;
    enablePickup: boolean;
    enableNoFreight: boolean;
    additionalDays: number;
  } | null>(null);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

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
      setSettings(
        data || {
          name: '',
          slug: '',
          description: '',
          coverImageUrl: '',
          pixKey: null,
          pixKeyType: null,
          whatsappNumber: null,
          primaryColor: '#DDAF02',
          secondaryColor: '#050505',
          customDomain: null,
          originCep: null,
          originState: null,
          originCity: null,
          originDistrict: null,
          originStreet: null,
          originNumber: null,
          originComplement: null,
          enableCorreios: true,
          correiosContractCode: null,
          correiosPassword: null,
          enablePickup: true,
          enableNoFreight: true,
          additionalDays: 0,
        }
      );
      setLoading(false);
    } catch (err) {
      console.error('[ADMIN_SETTINGS_LOAD_ERROR]', err);
      setErrorMessage('Erro ao carregar configurações');
      setLoading(false);
    }
  };

  const handleCepOriginChange = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    const formatted = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;

    setSettings((prev) => (prev ? { ...prev, originCep: formatted } : prev));

    if (clean.length === 8) {
      try {
        setCepLoading(true);
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setSettings((prev) =>
              prev
                ? {
                    ...prev,
                    originState: data.uf || prev.originState,
                    originCity: data.localidade || prev.originCity,
                    originDistrict: data.bairro || prev.originDistrict,
                    originStreet: data.logradouro || prev.originStreet,
                  }
                : prev
            );
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCepLoading(false);
      }
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
          ...settings,
          pixKey: settings.pixKey === '' ? null : settings.pixKey,
          pixKeyType: settings.pixKeyType === '' ? null : settings.pixKeyType,
          whatsappNumber: settings.whatsappNumber === '' ? null : settings.whatsappNumber,
          primaryColor: settings.primaryColor === '' ? null : settings.primaryColor,
          secondaryColor: settings.secondaryColor === '' ? null : settings.secondaryColor,
          customDomain: settings.customDomain === '' ? null : settings.customDomain,
          originCep: settings.originCep === '' ? null : settings.originCep,
          originState: settings.originState === '' ? null : settings.originState,
          originCity: settings.originCity === '' ? null : settings.originCity,
          originDistrict: settings.originDistrict === '' ? null : settings.originDistrict,
          originStreet: settings.originStreet === '' ? null : settings.originStreet,
          originNumber: settings.originNumber === '' ? null : settings.originNumber,
          originComplement: settings.originComplement === '' ? null : settings.originComplement,
          correiosContractCode: settings.correiosContractCode === '' ? null : settings.correiosContractCode,
          correiosPassword: settings.correiosPassword === '' ? null : settings.correiosPassword,
          additionalDays: Number(settings.additionalDays) || 0,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSuccessMessage('Configurações atualizadas com sucesso!');
        setSettings(updated);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (loading) {
    return (
      <div className="flex-1 min-h-[600px] flex items-center justify-center p-8 bg-[#050505]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-catalog-gold mx-auto" />
          <p className="text-xs font-mono uppercase tracking-widest text-catalog-muted">
            Carregando configurações da loja...
          </p>
        </div>
      </div>
    );
  }

  const isPixConfigured = Boolean(settings?.pixKey && settings?.pixKeyType);

  return (
    <div className="flex-1 space-y-8 p-6 md:p-10 max-w-5xl mx-auto">
      {/* Cabeçalho Canônico Continental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-widest mb-1.5">
            <Settings className="w-3.5 h-3.5" />
            <span>Painel Administrativo & Operacional</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-continental-display tracking-tight text-white">
            PIX, Contato & Logística
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Defina suas chaves de recebimento PIX, WhatsApp de suporte e endereço de origem para frete.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted">
            <span>Status PIX:</span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full border text-xs ${
                isPixConfigured
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              {isPixConfigured ? 'Ativo' : 'Pendente'}
            </span>
          </div>
        </div>
      </div>

      {/* Alertas de Sucesso / Erro */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2.5 shadow-lg">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {settings && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SEÇÃO 1: RECEBIMENTO PIX */}
          <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold font-continental-display text-white tracking-tight">
                    1. Recebimento Instantâneo via PIX
                  </h2>
                  <p className="text-xs text-catalog-muted font-light">
                    Chave oficial para liquidação direta das compras com geração automática de QR Code no checkout.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#050B14] border border-catalog-gold/20 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-catalog-gold shrink-0 mt-0.5" />
              <p className="text-xs text-catalog-muted leading-relaxed font-light">
                O cliente terá acesso imediato ao <strong className="text-catalog-gold">QR Code dinâmico</strong> e à chave <strong className="text-catalog-gold">Copia e Cola</strong> na página de confirmação do pedido com conciliação manual ou automática.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={settings.pixKey ?? ''}
                  onChange={(e) => setSettings((p) => (p ? { ...p, pixKey: e.target.value } : p))}
                  className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                  placeholder="Ex: financeiro@continental.com.br ou CNPJ"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                  Tipo de Chave PIX
                </label>
                <select
                  value={settings.pixKeyType ?? ''}
                  onChange={(e) => setSettings((p) => (p ? { ...p, pixKeyType: e.target.value } : p))}
                  className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B] text-xs font-mono text-white focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#050B14] text-neutral-400">Selecione o tipo de chave...</option>
                  <option value="CPF" className="bg-[#050B14] text-white">CPF</option>
                  <option value="CNPJ" className="bg-[#050B14] text-white">CNPJ</option>
                  <option value="EMAIL" className="bg-[#050B14] text-white">E-mail</option>
                  <option value="TELEFONE" className="bg-[#050B14] text-white">Telefone Celular</option>
                  <option value="ALEATORIA" className="bg-[#050B14] text-white">Chave Aleatória (EVP)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: CONTATO & WHATSAPP */}
          <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-catalog-gold/20 pb-4">
              <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-continental-display text-white tracking-tight">
                  2. Atendimento & WhatsApp de Suporte
                </h2>
                <p className="text-xs text-catalog-muted font-light">
                  Número oficial para envio de comprovantes, atendimento a clientes e frete a combinar.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                  WhatsApp com DDD
                </label>
                <input
                  type="text"
                  value={settings.whatsappNumber ?? ''}
                  onChange={(e) => setSettings((p) => (p ? { ...p, whatsappNumber: e.target.value } : p))}
                  className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                  placeholder="(16) 99999-9999"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#050B14] border border-catalog-gold/20 flex items-center text-xs text-catalog-muted font-light">
                <span>
                  Este contato é exibido nas telas de finalização de pedido caso o cliente deseje enviar comprovante ou tirar dúvidas.
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: LOGÍSTICA & ENDEREÇO DE ORIGEM */}
          <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-catalog-gold/20 pb-4">
              <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-continental-display text-white tracking-tight">
                  3. Endereço de Origem (Saída das Mercadorias)
                </h2>
                <p className="text-xs text-catalog-muted font-light">
                  Local físico de despacho utilizado para o cálculo das tabelas de frete dos Correios.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
                    <span>CEP de Saída</span>
                    {cepLoading && <Loader2 className="w-3 h-3 animate-spin text-catalog-gold" />}
                  </label>
                  <input
                    type="text"
                    value={settings.originCep ?? ''}
                    onChange={(e) => handleCepOriginChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={settings.originCity ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, originCity: e.target.value } : p))}
                    className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                    placeholder="Cidade"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    value={settings.originState ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, originState: e.target.value.toUpperCase() } : p))}
                    maxLength={2}
                    className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                    placeholder="SP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                    Rua / Logradouro
                  </label>
                  <input
                    type="text"
                    value={settings.originStreet ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, originStreet: e.target.value } : p))}
                    className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                    placeholder="Av. Principal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                    Número
                  </label>
                  <input
                    type="text"
                    value={settings.originNumber ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, originNumber: e.target.value } : p))}
                    className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                    placeholder="123"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: MODALIDADES DE FRETE */}
          <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-catalog-gold/20 pb-4">
              <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-continental-display text-white tracking-tight">
                  4. Modalidades de Envio Disponíveis no Checkout
                </h2>
                <p className="text-xs text-catalog-muted font-light">
                  Habilite ou desabilite opções de entrega e prazos adicionais de preparação.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Correios */}
              <div className="p-4 bg-[#050B14] rounded-xl border border-catalog-gold/20 space-y-2 hover:border-catalog-gold/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-white uppercase tracking-wider">
                    Correios (SEDEX & PAC)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enableCorreios}
                    onChange={(e) => setSettings((p) => (p ? { ...p, enableCorreios: e.target.checked } : p))}
                    className="h-4 w-4 rounded accent-[#DDAF02] cursor-pointer"
                  />
                </div>
                <p className="text-xs text-catalog-muted font-light leading-relaxed">
                  Cálculo automático de cotações em tempo real integrado às APIs oficiais dos Correios.
                </p>
              </div>

              {/* Retirada na Loja */}
              <div className="p-4 bg-[#050B14] rounded-xl border border-catalog-gold/20 space-y-2 hover:border-catalog-gold/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-white uppercase tracking-wider">
                    Retirada na Loja Física
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enablePickup}
                    onChange={(e) => setSettings((p) => (p ? { ...p, enablePickup: e.target.checked } : p))}
                    className="h-4 w-4 rounded accent-[#DDAF02] cursor-pointer"
                  />
                </div>
                <p className="text-xs text-catalog-muted font-light leading-relaxed">
                  Permite ao comprador retirar a mercadoria presencialmente no balcão sem cobrança de frete (R$ 0,00).
                </p>
              </div>

              {/* Frete a Combinar */}
              <div className="p-4 bg-[#050B14] rounded-xl border border-catalog-gold/20 space-y-2 hover:border-catalog-gold/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-white uppercase tracking-wider">
                    Frete a Combinar (WhatsApp)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enableNoFreight}
                    onChange={(e) => setSettings((p) => (p ? { ...p, enableNoFreight: e.target.checked } : p))}
                    className="h-4 w-4 rounded accent-[#DDAF02] cursor-pointer"
                  />
                </div>
                <p className="text-xs text-catalog-muted font-light leading-relaxed">
                  Permite concluir o pedido direcionando o cálculo do envio e transportadora para o WhatsApp.
                </p>
              </div>

              {/* Prazo Adicional */}
              <div className="p-4 bg-[#050B14] rounded-xl border border-catalog-gold/20 space-y-2 hover:border-catalog-gold/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-white uppercase tracking-wider">
                    Dias Extras de Expedição
                  </span>
                  <Clock className="w-4 h-4 text-catalog-gold" />
                </div>
                <input
                  type="number"
                  min={0}
                  value={settings.additionalDays}
                  onChange={(e) =>
                    setSettings((p) => (p ? { ...p, additionalDays: parseInt(e.target.value, 10) || 0 } : p))
                  }
                  className="w-full h-9 px-3 rounded-lg border border-catalog-gold/30 bg-[#0B132B] text-xs font-mono font-bold text-white focus:outline-none focus:border-catalog-gold"
                />
                <p className="text-[11px] text-catalog-muted font-light">
                  Dias somados ao prazo dos Correios para separação e embalagem técnica.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 5: IDENTIDADE INSTITUCIONAL */}
          <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-catalog-gold/20 pb-4">
              <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-continental-display text-white tracking-tight">
                  5. Identidade & Slug da Loja
                </h2>
                <p className="text-xs text-catalog-muted font-light">
                  Dados cadastrais que compõem o título da vitrine e a URL de navegação pública.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                  Nome da Loja
                </label>
                <input
                  type="text"
                  value={settings.name ?? ''}
                  onChange={(e) => setSettings((p) => (p ? { ...p, name: e.target.value } : p))}
                  className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                  Slug / Subdomínio
                </label>
                <input
                  type="text"
                  value={settings.slug ?? ''}
                  onChange={(e) =>
                    setSettings((p) => (p ? { ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : p))
                  }
                  className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                  required
                />
              </div>
            </div>
          </div>

          {/* Barra de Ações / Salvar */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider px-8 py-3.5 shadow-[0_0_25px_rgba(240,180,14,0.3)] hover:shadow-[0_0_35px_rgba(240,180,14,0.5)] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Salvando Alterações...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-black" />
                  <span>Salvar Todas as Configurações</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}