'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Truck, MapPin, Store, Clock, ChevronRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { FreightOption } from '@/types/freight';

interface ProductFreightCalculatorProps {
  productId: string;
  price?: number;
  lojaID?: string;
  className?: string;
}

interface LocationInfo {
  city: string;
  state: string;
  neighborhood?: string;
}

export const ProductFreightCalculator: React.FC<ProductFreightCalculatorProps> = ({
  productId,
  price,
  lojaID,
  className = '',
}) => {
  const [cep, setCep] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<FreightOption[]>([]);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  // Formata o CEP com máscara: 00000-000
  const formatCep = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return numbers;
  };

  // Busca detalhes da localidade via ViaCEP
  const fetchLocation = async (cleanCep: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setLocation({
            city: data.localidade,
            state: data.uf,
            neighborhood: data.bairro,
          });
          return;
        }
      }
    } catch {
      // Falha silenciosa para não travar o cálculo de frete
    }
    setLocation(null);
  };

  // Executa o cálculo de frete
  const handleCalculate = useCallback(
    async (targetCep?: string) => {
      const rawCep = targetCep ?? cep;
      const cleanCep = rawCep.replace(/\D/g, '');

      if (cleanCep.length !== 8) {
        setError('Digite um CEP válido com 8 dígitos.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Dispara busca paralela de cidade/UF
        fetchLocation(cleanCep);

        const response = await fetch('/api/freight/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lojaID,
            destinationCep: cleanCep,
            items: [
              {
                productId,
                quantity: 1,
                price: price || 0,
              },
            ],
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Não foi possível calcular o frete para este CEP.');
        }

        const calculatedOptions: FreightOption[] = data.data?.options || [];
        setOptions(calculatedOptions);
        setHasCalculated(true);

        // Salva CEP no localStorage para persistência anônima
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('continental_freight_cep', formatCep(cleanCep));
          } catch {
            // Ignora falhas de localStorage (ex: navegação privada estrita)
          }
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao consultar opções de entrega.');
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [cep, productId, price, lojaID]
  );

  // Carrega CEP salvo do localStorage na inicialização e calcula automaticamente se já houver CEP
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCep = localStorage.getItem('continental_freight_cep');
        if (savedCep) {
          const formatted = formatCep(savedCep);
          setCep(formatted);
          if (formatted.replace(/\D/g, '').length === 8) {
            handleCalculate(formatted);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [productId]); // Recalcula se o produto mudar

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    if (error) setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCalculate();
    }
  };

  // Identifica a opção mais rápida e a mais econômica
  const lowestPriceNonZero = options
    .filter((o) => o.price > 0)
    .reduce((min, o) => (o.price < min ? o.price : min), Infinity);

  return (
    <div
      className={`rounded-2xl border border-catalog-gold/25 bg-[#0B111E]/80 backdrop-blur-md p-5 shadow-2xl transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-xl bg-catalog-gold/10 border border-catalog-gold/30 text-catalog-gold">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-catalog-text flex items-center gap-2">
            Calcular Frete e Prazo
          </h3>
          <p className="text-xs text-catalog-muted">
            Consulte opções de envio reais para o seu endereço
          </p>
        </div>
      </div>

      {/* Input Form */}
      <div className="mt-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={cep}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="00000-000"
              maxLength={9}
              className="w-full bg-[#050B14] border border-catalog-gold/30 focus:border-catalog-gold rounded-xl px-4 py-3 text-sm text-catalog-text placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-catalog-gold font-mono tracking-wider transition-all"
              aria-label="CEP para cálculo de frete"
            />
            {cep.replace(/\D/g, '').length === 8 && !isLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-catalog-gold">
                <CheckCircle2 className="w-4 h-4 opacity-75" />
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleCalculate()}
            disabled={isLoading || cep.replace(/\D/g, '').length < 8}
            className="btn-shimmer px-5 py-3 rounded-xl bg-catalog-gold text-[#0F172A] font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Calculando...</span>
              </>
            ) : (
              <span>Calcular</span>
            )}
          </button>
        </div>

        {/* Link Não sei meu CEP */}
        <div className="flex items-center justify-between mt-2 px-1 text-xs">
          <a
            href="https://buscacepinter.correios.com.br/app/endereco/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="text-catalog-muted hover:text-catalog-gold transition-colors underline underline-offset-2 flex items-center gap-1"
          >
            Não sei meu CEP
          </a>

          {location && (
            <span className="text-catalog-gold/90 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {location.city} - {location.state}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="mt-4 space-y-2 animate-pulse">
          <div className="h-14 bg-catalog-gold/5 rounded-xl border border-catalog-gold/10" />
          <div className="h-14 bg-catalog-gold/5 rounded-xl border border-catalog-gold/10" />
        </div>
      )}

      {/* Lista de Opções de Frete */}
      {!isLoading && hasCalculated && options.length > 0 && (
        <div className="mt-4 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((option, index) => {
            const isPickup = option.providerId === 'STORE_PICKUP' || option.serviceCode === 'PICKUP';
            const isJt = option.providerId === 'JT_EXPRESS';
            const isFree = option.price === 0;
            const isLowest = !isFree && option.price === lowestPriceNonZero;

            return (
              <div
                key={`${option.providerId}-${option.serviceCode}-${index}`}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isFree
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : isLowest || option.isRecommended
                      ? 'bg-catalog-gold/10 border-catalog-gold/40 hover:border-catalog-gold/60'
                      : 'bg-[#050B14]/60 border-neutral-800 hover:border-catalog-gold/20'
                }`}
              >
                {/* Ícone e Nome do Serviço */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isFree
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isJt
                          ? 'bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/30'
                          : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {isPickup ? <Store className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-catalog-text truncate">
                        {option.serviceName}
                      </span>

                      {/* Badges de Destaque */}
                      {isFree && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Grátis
                        </span>
                      )}

                      {isLowest && !isFree && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-catalog-gold/20 text-catalog-gold border border-catalog-gold/40">
                          Mais Econômico
                        </span>
                      )}

                      {isJt && !isLowest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Entrega Rápida
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-catalog-muted mt-0.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isPickup
                          ? 'Retirada imediata no balcão'
                          : option.deliveryTimeInDays === 1
                            ? 'Em até 1 dia útil'
                            : `Em até ${option.deliveryTimeInDays} dias úteis`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preço */}
                <div className="text-right shrink-0">
                  {isFree ? (
                    <span className="text-sm font-bold text-emerald-400">R$ 0,00</span>
                  ) : (
                    <span className="text-sm font-bold text-catalog-text">
                      R$ {option.price.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Caso retorne 0 opções */}
      {!isLoading && hasCalculated && options.length === 0 && !error && (
        <div className="mt-4 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 text-center text-xs text-catalog-muted">
          Nenhuma opção de entrega disponível para este CEP no momento.
        </div>
      )}
    </div>
  );
};

export default ProductFreightCalculator;
