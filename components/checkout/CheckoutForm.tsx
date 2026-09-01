'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Button, AlertBanner, Spinner } from '@/components/ui'
import { FreightOption } from '@/types/freight'
import { LoyaltyPointsWidget } from './LoyaltyPointsWidget'

export interface CartItem {
  productId?: string
  name: string
  quantity: number
  price: number
  color?: string
  size?: string
}

export interface CheckoutResult {
  orderNumber: number
  orderId: string
  total: number
  subtotal: number
  freightValue: number | null
  shippingCost: number
  shippingProvider: string | null
  shippingServiceName: string | null
  shippingEstimatedDays: number | null
  pixKey: string | null
  pointsEarned?: number
  pointsRedeemed?: number
  pointsDiscountValue?: number
  customer: { name: string; phone: string }
  items: Array<{ name: string; quantity: number; price: number }>
  deliveryType: string
}

export interface CheckoutFormProps {
  lojaID: string
  pixKey: string
  whatsappNumber: string
  items?: CartItem[]
  onOrderCreated: (result: CheckoutResult) => void
}

type Step = 1 | 2 | 3

export function CheckoutForm({ lojaID, pixKey, whatsappNumber, items = [], onOrderCreated }: CheckoutFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados de Frete
  const [freightOptions, setFreightOptions] = useState<FreightOption[]>([])
  const [selectedFreight, setSelectedFreight] = useState<FreightOption | null>(null)
  const [isFetchingFreight, setIsFetchingFreight] = useState(false)
  const [isFetchingCep, setIsFetchingCep] = useState(false)

  // Estados de Fidelidade / Pontos
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0)
  const [pointsDiscountValue, setPointsDiscountValue] = useState<number>(0)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryType: 'DELIVERY' as 'DELIVERY' | 'PICKUP' | 'NONE',
    address: {
      state: '',
      city: '',
      neighborhood: '',
      street: '',
      number: '',
      complement: '',
      cep: '',
    },
  })

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items])

  const calculatedFreightCost = useMemo(() => {
    if (formData.deliveryType === 'PICKUP' || formData.deliveryType === 'NONE') {
      return 0
    }
    return selectedFreight ? selectedFreight.price : 0
  }, [formData.deliveryType, selectedFreight])

  const subtotalAfterPoints = useMemo(
    () => Math.max(0, subtotal - pointsDiscountValue),
    [subtotal, pointsDiscountValue]
  )

  const grandTotal = useMemo(
    () => subtotalAfterPoints + calculatedFreightCost,
    [subtotalAfterPoints, calculatedFreightCost]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.startsWith('address.')) {
      const field = name.split('.')[1]
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [field]: value },
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 11) val = val.slice(0, 11)
    if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`
    if (val.length > 10) val = `${val.slice(0, 10)}-${val.slice(10)}`
    setFormData((prev) => ({ ...prev, phone: val }))
  }

  // Função para buscar opções de frete na API
  const fetchFreightOptions = useCallback(
    async (cep: string) => {
      const cleanCep = cep.replace(/\D/g, '')
      if (cleanCep.length !== 8 || !lojaID) return

      setIsFetchingFreight(true)
      try {
        const payload = {
          lojaID,
          destinationCep: cleanCep,
          items: items.map((item: any) => ({
            productId: item.productID || item.productId,
            name: item.productName || item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        }

        const res = await fetch('/api/freight/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const json = await res.json()
          if (json.success && Array.isArray(json.data?.options)) {
            const options: FreightOption[] = json.data.options
            setFreightOptions(options)

            // Auto-seleciona a opção econômica ou recomendada se nenhuma selecionada
            const defaultOption =
              options.find((o) => o.isRecommended) ||
              options.find((o) => o.price > 0) ||
              options[0]

            if (defaultOption) {
              setSelectedFreight(defaultOption)
            }
          }
        }
      } catch (err) {
        console.error('[FREIGHT_FETCH_ERROR]', err)
      } finally {
        setIsFetchingFreight(false)
      }
    },
    [lojaID, items]
  )

  // Busca de CEP via ViaCEP + Disparo de Cotação de Frete
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 8) val = val.slice(0, 8)
    const formatted = val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val

    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, cep: formatted },
    }))

    if (val.length === 8) {
      setIsFetchingCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`)
        if (res.ok) {
          const data = await res.json()
          if (!data.erro) {
            setFormData((prev) => ({
              ...prev,
              address: {
                ...prev.address,
                state: data.uf || '',
                city: data.localidade || '',
                neighborhood: data.bairro || '',
                street: data.logradouro || '',
              },
            }))
          }
        }
      } catch (err) {
        console.error('[VIACEP_ERROR]', err)
      } finally {
        setIsFetchingCep(false)
      }

      // Calcula as opções de frete
      await fetchFreightOptions(val)
    }
  }

  const validateStep1 = () => {
    if (!formData.name || formData.name.length < 2) return 'Nome deve ter pelo menos 2 caracteres.'
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) return 'Email inválido.'
    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) return 'Telefone inválido.'
    return null
  }

  const validateStep2 = () => {
    if (formData.deliveryType === 'DELIVERY') {
      const { state, city, neighborhood, street, number, cep } = formData.address
      if (!state || !city || !neighborhood || !street || !number) {
        return 'Preencha todos os campos obrigatórios do endereço.'
      }
      if (!cep || !/^\d{5}-?\d{3}$/.test(cep)) {
        return 'CEP inválido. Use o formato 00000-000.'
      }
      if (!selectedFreight) {
        return 'Por favor, selecione uma opção de frete para a entrega.'
      }
    }
    return null
  }

  const nextStep = async () => {
    setError(null)
    if (step === 1) {
      const err = validateStep1()
      if (err) return setError(err)
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) return setError(err)
      setStep(3)
    }
  }

  const prevStep = () => {
    setError(null)
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  const handleSubmit = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const payload = {
        lojaID,
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone.replace(/\D/g, ''),
        },
        items: items.map((item: any) => ({
          productId: item.productID || item.productId,
          name: item.productName || item.name,
          quantity: item.quantity,
          price: item.price,
          color: item.color,
          size: item.size,
        })),
        deliveryType: formData.deliveryType,
        address: formData.deliveryType === 'DELIVERY' ? formData.address : undefined,
        freightValue: calculatedFreightCost > 0 ? calculatedFreightCost : undefined,
        shippingCost: calculatedFreightCost,
        shippingProvider:
          formData.deliveryType === 'PICKUP'
            ? 'STORE_PICKUP'
            : formData.deliveryType === 'NONE'
            ? 'NONE'
            : selectedFreight?.providerId || 'CORREIOS',
        shippingServiceName:
          formData.deliveryType === 'PICKUP'
            ? 'Retirada na Loja'
            : formData.deliveryType === 'NONE'
            ? 'A Combinar via WhatsApp'
            : selectedFreight?.serviceName || 'Entrega',
        shippingEstimatedDays:
          formData.deliveryType === 'DELIVERY' ? selectedFreight?.deliveryTimeInDays : 0,
        pixKey,
        pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar o pedido.')
      }

      onOrderCreated(data.data.order)
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado ao finalizar o pedido.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-zinc-950 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800/50 overflow-hidden">
      {/* Header & Progress */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-8 border-b border-zinc-100 dark:border-zinc-800/50">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Finalizar Pedido</h2>
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#dbb501] transition-all duration-500 ease-out"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-500
                ${
                  step >= s
                    ? 'bg-[#dbb501] text-zinc-950 shadow-[0_0_15px_rgba(219,181,1,0.4)]'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                }`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span>Seus Dados</span>
          <span>Entrega & Frete</span>
          <span>Revisão & Pagamento</span>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {error && (
          <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
            <AlertBanner variant="error" message={error} />
          </div>
        )}

        <div className="min-h-[300px]">
          {/* STEP 1: DADOS PESSOAIS */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome Completo</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                  placeholder="Ex: joao@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Telefone (WhatsApp)</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          )}

          {/* STEP 2: ENTREGA & SELEÇÃO DE FRETE */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Opções de Modalidade */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, deliveryType: 'DELIVERY' }))}
                  className={`p-3.5 rounded-xl border-2 text-center transition-all duration-200 ${
                    formData.deliveryType === 'DELIVERY'
                      ? 'border-[#dbb501] bg-[#dbb501]/5 text-[#dbb501]'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="block font-medium text-sm">Receber</span>
                  <span className="text-[11px] opacity-80 mt-0.5 block">Correios / Envio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData((p) => ({ ...p, deliveryType: 'PICKUP' }))
                    setSelectedFreight(null)
                  }}
                  className={`p-3.5 rounded-xl border-2 text-center transition-all duration-200 ${
                    formData.deliveryType === 'PICKUP'
                      ? 'border-[#dbb501] bg-[#dbb501]/5 text-[#dbb501]'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="block font-medium text-sm">Retirar</span>
                  <span className="text-[11px] opacity-80 mt-0.5 block">Grátis no Balcão</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData((p) => ({ ...p, deliveryType: 'NONE' }))
                    setSelectedFreight(null)
                  }}
                  className={`p-3.5 rounded-xl border-2 text-center transition-all duration-200 ${
                    formData.deliveryType === 'NONE'
                      ? 'border-[#dbb501] bg-[#dbb501]/5 text-[#dbb501]'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="block font-medium text-sm">A Combinar</span>
                  <span className="text-[11px] opacity-80 mt-0.5 block">Sem Frete Agora</span>
                </button>
              </div>

              {formData.deliveryType === 'PICKUP' && (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                  <span className="inline-block p-2 bg-[#dbb501]/10 text-[#dbb501] rounded-full mb-2 text-lg">🏪</span>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Retirada na Loja Física (R$ 0,00)</h4>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">
                    Você optou por retirar seu pedido pessoalmente. Enviaremos o endereço completo e instruções pelo WhatsApp assim que o pagamento for confirmado.
                  </p>
                </div>
              )}

              {formData.deliveryType === 'NONE' && (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                  <span className="inline-block p-2 bg-[#dbb501]/10 text-[#dbb501] rounded-full mb-2 text-lg">💬</span>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Frete a Combinar via WhatsApp</h4>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">
                    Nenhum valor de frete será adicionado a esta compra agora. Você poderá combinar o envio (motoboy, transportadora própria ou frete especial) diretamente pelo WhatsApp com a loja.
                  </p>
                </div>
              )}

              {formData.deliveryType === 'DELIVERY' && (
                <div className="space-y-4">
                  {/* CEP com Busca Automática */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">CEP de Entrega</label>
                      {(isFetchingCep || isFetchingFreight) && (
                        <span className="text-xs text-[#dbb501] flex items-center gap-1">
                          <Spinner className="h-3 w-3" /> Calculando frete e endereço...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      name="address.cep"
                      value={formData.address.cep}
                      onChange={handleCepChange}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all font-mono"
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>

                  {/* Lista de Opções de Frete */}
                  {freightOptions.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Escolha a opção de envio:
                      </label>

                      <div className="space-y-2">
                        {freightOptions.map((opt, idx) => {
                          const isSelected =
                            selectedFreight?.serviceCode === opt.serviceCode &&
                            selectedFreight?.providerId === opt.providerId

                          return (
                            <div
                              key={`${opt.providerId}_${opt.serviceCode}_${idx}`}
                              onClick={() => setSelectedFreight(opt)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'border-[#dbb501] bg-[#dbb501]/5 dark:bg-[#dbb501]/10'
                                  : 'border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-[#dbb501] bg-[#dbb501]'
                                      : 'border-zinc-300 dark:border-zinc-700'
                                  }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-zinc-950" />}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                      {opt.serviceName}
                                    </span>
                                    {opt.isRecommended && (
                                      <span className="px-2 py-0.5 text-[10px] font-bold bg-[#dbb501]/20 text-[#dbb501] rounded-full">
                                        Recomendado
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {opt.deliveryTimeInDays > 0
                                      ? `Prazo estimado: ${opt.deliveryTimeInDays} dias úteis`
                                      : opt.description || 'Entrega'}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                  {opt.price === 0 ? 'Grátis' : `R$ ${opt.price.toFixed(2)}`}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campos de Endereço */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado</label>
                      <input
                        type="text"
                        name="address.state"
                        value={formData.address.state}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                        placeholder="UF"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidade</label>
                      <input
                        type="text"
                        name="address.city"
                        value={formData.address.city}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                        placeholder="Sua cidade"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Bairro</label>
                    <input
                      type="text"
                      name="address.neighborhood"
                      value={formData.address.neighborhood}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                      placeholder="Ex: Centro"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Rua</label>
                      <input
                        type="text"
                        name="address.street"
                        value={formData.address.street}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                        placeholder="Ex: Av. Brasil"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Número</label>
                      <input
                        type="text"
                        name="address.number"
                        value={formData.address.number}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Complemento (opcional)</label>
                    <input
                      type="text"
                      name="address.complement"
                      value={formData.address.complement}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                      placeholder="Apto, Bloco..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: REVISÃO & PAGAMENTO */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Widget de Fidelidade e Resgate de Pontos */}
              <LoyaltyPointsWidget
                lojaID={lojaID}
                subtotal={subtotal}
                onPointsApplied={({ pointsToRedeem, discountValue }) => {
                  setPointsToRedeem(pointsToRedeem)
                  setPointsDiscountValue(discountValue)
                }}
              />

              <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-4">Resumo do Pedido</h3>

                {/* Itens */}
                <div className="space-y-3 mb-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {item.quantity}x {(item as any).productName || item.name}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />

                {/* Linhas de Valores */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Subtotal dos Produtos</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">R$ {subtotal.toFixed(2)}</span>
                  </div>

                  {/* Desconto de Fidelidade Aplicado */}
                  {pointsDiscountValue > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span>Desconto Fidelidade ({pointsToRedeem} pts)</span>
                      </span>
                      <span className="font-bold font-mono">
                        - R$ {pointsDiscountValue.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                      <span>Frete / Envio:</span>
                      <span className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 font-medium">
                        {formData.deliveryType === 'PICKUP'
                          ? 'Retirada na Loja'
                          : formData.deliveryType === 'NONE'
                          ? 'A Combinar via WhatsApp'
                          : selectedFreight?.serviceName || 'Correios'}
                      </span>
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formData.deliveryType === 'PICKUP' || formData.deliveryType === 'NONE' ? (
                        <span className="text-emerald-500 font-bold">R$ 0,00</span>
                      ) : selectedFreight ? (
                        `R$ ${selectedFreight.price.toFixed(2)}`
                      ) : (
                        'R$ 0,00'
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Total do Pedido</span>
                    <span className="font-bold text-[#dbb501] text-xl">R$ {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Informações de Pagamento */}
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200/60 dark:border-amber-900/30">
                <p className="text-sm text-amber-800 dark:text-amber-300 text-center">
                  Após confirmar, você será redirecionado para o WhatsApp com os dados do pedido para pagar via PIX e acompanhar seu envio.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1 || isLoading}
            className={step === 1 ? 'invisible' : ''}
          >
            Voltar
          </Button>

          {step < 3 ? (
            <Button
              onClick={nextStep}
              disabled={isFetchingFreight || isFetchingCep}
              className="bg-[#dbb501] hover:bg-[#dbb501]/90 text-zinc-950 px-8 font-medium"
            >
              {isFetchingFreight && <Spinner className="mr-2 h-4 w-4" />}
              Continuar
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-[#dbb501] hover:bg-[#dbb501]/90 text-zinc-950 px-8 shadow-[0_0_20px_rgba(219,181,1,0.3)] font-semibold"
            >
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              Confirmar e Pagar via PIX
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
