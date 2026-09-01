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
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-[#DDAF02]/50 border-t-[#DDAF02] rounded-full animate-spin" />
          <p className="mt-3 text-xs text-neutral-400">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Configurações da Loja</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gerencie identidade, recebimentos PIX, contatos e logística de fretes da sua loja.
          </p>
        </div>

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-400 font-medium text-sm">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400 font-medium text-sm">{errorMessage}</p>
          </div>
        )}

        {settings && (
          <form onSubmit={handleSubmit} className="space-y-8 bg-zinc-950 p-6 sm:p-8 rounded-2xl border border-white/5">
            {/* SEÇÃO 1: IDENTIDADE */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#DDAF02] border-b border-white/10 pb-2">
                1. Identidade & Visual
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-300">Nome da Loja</label>
                  <input
                    type="text"
                    value={settings.name ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, name: e.target.value } : p))}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-300">Slug (Subdomínio)</label>
                  <input
                    type="text"
                    value={settings.slug ?? ''}
                    onChange={(e) =>
                      setSettings((p) => (p ? { ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : p))
                    }
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: LOGÍSTICA & FRETE */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#DDAF02] border-b border-white/10 pb-2">
                2. Logística & Configurações de Frete (Origem e Transportadoras)
              </h2>

              {/* CEP de Origem e Endereço de Saída */}
              <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-xs font-semibold text-neutral-200">Endereço de Origem (De onde saem os pacotes)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">CEP de Saída (Origem)</label>
                    <input
                      type="text"
                      value={settings.originCep ?? ''}
                      onChange={(e) => handleCepOriginChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Cidade</label>
                    <input
                      type="text"
                      value={settings.originCity ?? ''}
                      onChange={(e) => setSettings((p) => (p ? { ...p, originCity: e.target.value } : p))}
                      className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Estado (UF)</label>
                    <input
                      type="text"
                      value={settings.originState ?? ''}
                      onChange={(e) => setSettings((p) => (p ? { ...p, originState: e.target.value } : p))}
                      className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs text-neutral-400">Rua / Logradouro</label>
                    <input
                      type="text"
                      value={settings.originStreet ?? ''}
                      onChange={(e) => setSettings((p) => (p ? { ...p, originStreet: e.target.value } : p))}
                      className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400">Número</label>
                    <input
                      type="text"
                      value={settings.originNumber ?? ''}
                      onChange={(e) => setSettings((p) => (p ? { ...p, originNumber: e.target.value } : p))}
                      className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Opções de Serviços de Frete */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Correios */}
                <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Integração Correios (SEDEX & PAC)</span>
                    <input
                      type="checkbox"
                      checked={settings.enableCorreios}
                      onChange={(e) => setSettings((p) => (p ? { ...p, enableCorreios: e.target.checked } : p))}
                      className="h-4 w-4 rounded accent-[#DDAF02] cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-neutral-400">
                    Calcula automaticamente preços e prazos oficiais dos Correios para o cliente no checkout.
                  </p>
                </div>

                {/* Retirada na Loja */}
                <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Permitir Retirada no Balcão</span>
                    <input
                      type="checkbox"
                      checked={settings.enablePickup}
                      onChange={(e) => setSettings((p) => (p ? { ...p, enablePickup: e.target.checked } : p))}
                      className="h-4 w-4 rounded accent-[#DDAF02] cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-neutral-400">
                    Permite ao cliente optar por buscar o pedido na loja física sem custo de frete (R$ 0,00).
                  </p>
                </div>

                {/* Sem Frete / WhatsApp */}
                <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Permitir &quot;Frete a Combinar&quot;</span>
                    <input
                      type="checkbox"
                      checked={settings.enableNoFreight}
                      onChange={(e) => setSettings((p) => (p ? { ...p, enableNoFreight: e.target.checked } : p))}
                      className="h-4 w-4 rounded accent-[#DDAF02] cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-neutral-400">
                    Permite ao cliente fechar o pedido sem escolher frete, combinando o envio diretamente pelo WhatsApp.
                  </p>
                </div>

                {/* Dias Adicionais de Manuseio */}
                <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/5 space-y-3">
                  <label className="block font-semibold text-sm">Prazo Adicional de Expedição (Dias)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.additionalDays}
                    onChange={(e) =>
                      setSettings((p) => (p ? { ...p, additionalDays: parseInt(e.target.value, 10) || 0 } : p))
                    }
                    className="w-full px-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm"
                  />
                  <p className="text-xs text-neutral-400">
                    Dias adicionados à estimativa dos Correios para tempo de separação e embalagem.
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: PIX & CONTATO */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#DDAF02] border-b border-white/10 pb-2">
                3. Recebimento PIX & Contato
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-300">Chave PIX</label>
                  <input
                    type="text"
                    value={settings.pixKey ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, pixKey: e.target.value } : p))}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm"
                    placeholder="Chave PIX"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-300">Tipo de Chave</label>
                  <select
                    value={settings.pixKeyType ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, pixKeyType: e.target.value } : p))}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm"
                  >
                    <option value="">Selecione...</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="ALEATORIA">Aleatória</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-300">WhatsApp de Atendimento</label>
                  <input
                    type="text"
                    value={settings.whatsappNumber ?? ''}
                    onChange={(e) => setSettings((p) => (p ? { ...p, whatsappNumber: e.target.value } : p))}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
              <Button
                type="submit"
                disabled={submitLoading}
                className="bg-[#DDAF02] hover:bg-[#DDAF02]/90 text-neutral-950 font-bold px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(221,175,2,0.3)]"
              >
                {submitLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}