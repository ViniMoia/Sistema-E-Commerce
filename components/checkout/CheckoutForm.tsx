'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { AlertBanner, Spinner } from '@/components/ui'
import { FreightOption } from '@/types/freight'
import { LoyaltyPointsWidget } from './LoyaltyPointsWidget'
import { formatCpfCnpj, validateCpfCnpj, cleanDigits } from '@/lib/validators/cpf-cnpj'
import { calculateInstallmentOptions, type InstallmentOption } from '@/services/payment/installment.service'
import { validateLuhn } from '@/lib/validators/checkout.validators'
import {
  QrCode,
  CreditCard,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  Store,
  MessageSquare,
  Lock,
  ArrowRight,
  ArrowLeft,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'

export interface CartItem {
  productId?: string
  name: string
  productName?: string
  quantity: number
  price: number
  color?: string
  size?: string
  imageUrl?: string
  image?: string
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
  paymentMethod?: string | null
  asaasPaymentId?: string | null
  pixQrCode?: string | null
  pixPayload?: string | null
  creditCardBrand?: string | null
  creditCardLast4?: string | null
  installments?: number | null
  installmentValue?: number | null
  asaasBankSlipUrl?: string | null
  asaasDigitableLine?: string | null
  asaasBarCode?: string | null
  asaasDueDate?: string | null
  pointsEarned?: number
  pointsRedeemed?: number
  pointsDiscountValue?: number
  customer: { name: string; phone: string; cpfCnpj?: string }
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
export type PaymentMethodTab = 'PIX' | 'CREDIT_CARD' | 'BOLETO'

export function CheckoutForm({
  lojaID,
  pixKey,
  whatsappNumber,
  items = [],
  onOrderCreated,
}: CheckoutFormProps) {
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

  // Meio de Pagamento Selecionado
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodTab>('PIX')

  // Dados do Cartão de Crédito
  const [cardData, setCardData] = useState({
    holderName: '',
    number: '',
    expiryDate: '', // MM/AA
    ccv: '',
  })
  const [selectedInstallment, setSelectedInstallment] = useState<number>(1)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpfCnpj: '',
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

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items]
  )

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

  // Opções de Parcelamento do Cartão de Crédito
  const installmentOptions: InstallmentOption[] = useMemo(() => {
    if (grandTotal <= 0) return []
    return calculateInstallmentOptions(grandTotal)
  }, [grandTotal])

  const selectedInstallmentDetail = useMemo(() => {
    return (
      installmentOptions.find((opt) => opt.count === selectedInstallment) ||
      installmentOptions[0]
    )
  }, [installmentOptions, selectedInstallment])

  // Detecção de Bandeira do Cartão
  const detectedCardBrand = useMemo(() => {
    const num = cardData.number.replace(/\D/g, '')
    if (/^4/.test(num)) return { name: 'Visa', color: 'border-blue-500/50 text-blue-400 bg-blue-500/10' }
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(num))
      return { name: 'Mastercard', color: 'border-amber-500/50 text-amber-400 bg-amber-500/10' }
    if (/^3[47]/.test(num)) return { name: 'Amex', color: 'border-sky-500/50 text-sky-400 bg-sky-500/10' }
    if (/^(4011|4389|4514|4576|5041|5066|5090|6277|6362|6363)/.test(num))
      return { name: 'Elo', color: 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' }
    if (/^6062/.test(num)) return { name: 'Hipercard', color: 'border-red-500/50 text-red-400 bg-red-500/10' }
    return null
  }, [cardData.number])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      setFormData((prev: any) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 11) val = val.slice(0, 11)
    if (val.length > 6) {
      val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`
    } else if (val.length > 2) {
      val = `(${val.slice(0, 2)}) ${val.slice(2)}`
    }
    setFormData((prev) => ({ ...prev, phone: val }))
  }

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '')
    if (raw.length > 8) raw = raw.slice(0, 8)
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw

    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, cep: formatted },
    }))

    if (raw.length === 8) {
      setIsFetchingCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              state: data.uf,
              city: data.localidade,
              neighborhood: data.bairro,
              street: data.logradouro,
            },
          }))
          calculateFreight(raw)
        }
      } catch (err) {
        console.error('Erro ao consultar CEP:', err)
      } finally {
        setIsFetchingCep(false)
      }
    }
  }

  const calculateFreight = useCallback(
    async (cepDigits: string) => {
      if (!lojaID || cepDigits.length !== 8) return
      setIsFetchingFreight(true)
      setSelectedFreight(null)
      try {
        const res = await fetch('/api/freight/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lojaId: lojaID,
            destinationCep: cepDigits,
            items: items.map((i) => ({
              weightInKg: 0.5,
              heightInCm: 10,
              widthInCm: 15,
              lengthInCm: 20,
              quantity: i.quantity,
            })),
          }),
        })
        const data = await res.json()
        if (data.options && data.options.length > 0) {
          setFreightOptions(data.options)
          const recommended = data.options.find((o: FreightOption) => o.isRecommended)
          setSelectedFreight(recommended || data.options[0])
        } else {
          setFreightOptions([])
        }
      } catch (err) {
        console.error('Erro ao calcular frete:', err)
      } finally {
        setIsFetchingFreight(false)
      }
    },
    [lojaID, items]
  )

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '')
    if (v.length > 16) v = v.slice(0, 16)
    const formatted = v.replace(/(\d{4})/g, '$1 ').trim()
    setCardData((prev) => ({ ...prev, number: formatted }))
  }

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '')
    if (v.length > 4) v = v.slice(0, 4)
    if (v.length > 2) {
      v = `${v.slice(0, 2)}/${v.slice(2)}`
    }
    setCardData((prev) => ({ ...prev, expiryDate: v }))
  }

  const handleCardCcvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCardData((prev) => ({ ...prev, ccv: v }))
  }

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError('Por favor, informe seu nome completo.')
      return false
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Por favor, informe um e-mail válido.')
      return false
    }
    if (!formData.phone.trim() || cleanDigits(formData.phone).length < 10) {
      setError('Por favor, informe um WhatsApp ou telefone com DDD.')
      return false
    }
    if (!formData.cpfCnpj.trim() || !validateCpfCnpj(formData.cpfCnpj)) {
      setError('Por favor, informe um CPF ou CNPJ válido para emissão do pedido.')
      return false
    }
    setError(null)
    return true
  }

  const validateStep2 = () => {
    if (formData.deliveryType === 'DELIVERY') {
      const cleanCep = cleanDigits(formData.address.cep)
      if (cleanCep.length !== 8) {
        setError('Por favor, informe um CEP válido com 8 dígitos.')
        return false
      }
      if (!formData.address.street.trim() || !formData.address.number.trim()) {
        setError('Por favor, informe a rua e o número para a entrega.')
        return false
      }
      if (!formData.address.city.trim() || !formData.address.state.trim()) {
        setError('Por favor, informe a cidade e o estado.')
        return false
      }
      if (freightOptions.length > 0 && !selectedFreight) {
        setError('Por favor, selecione uma modalidade de frete.')
        return false
      }
    }
    setError(null)
    return true
  }

  const validateStep3 = () => {
    if (paymentMethod === 'CREDIT_CARD') {
      const cleanNum = cleanDigits(cardData.number)
      if (!validateLuhn(cleanNum)) {
        setError('Número de cartão de crédito inválido.')
        return false
      }
      if (!cardData.holderName.trim()) {
        setError('Informe o nome impresso no cartão de crédito.')
        return false
      }
      const [mm, yy] = cardData.expiryDate.split('/')
      if (!mm || !yy || mm.length !== 2 || yy.length !== 2) {
        setError('Validade do cartão deve estar no formato MM/AA.')
        return false
      }
      const expMonth = parseInt(mm, 10)
      if (expMonth < 1 || expMonth > 12) {
        setError('Mês de validade do cartão inválido.')
        return false
      }
      if (cardData.ccv.length < 3) {
        setError('Código de segurança (CVV) inválido.')
        return false
      }
    }
    setError(null)
    return true
  }

  const nextStep = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((prev) => Math.min(3, prev + 1) as Step)
  }

  const prevStep = () => {
    setError(null)
    setStep((prev) => Math.max(1, prev - 1) as Step)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return

    setIsLoading(true)
    setError(null)

    try {
      const [expiryMonth, expiryYear] = cardData.expiryDate.split('/')
      const fullExpiryYear = expiryYear ? `20${expiryYear}` : ''

      const payload = {
        lojaID,
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: cleanDigits(formData.phone),
        customerCpfCnpj: cleanDigits(formData.cpfCnpj),
        deliveryType: formData.deliveryType,
        address: formData.deliveryType === 'DELIVERY' ? formData.address : undefined,
        shippingCost: calculatedFreightCost,
        shippingProvider: selectedFreight?.providerId || null,
        shippingServiceName: selectedFreight?.serviceName || null,
        shippingEstimatedDays: selectedFreight?.deliveryTimeInDays || null,
        paymentMethod,
        pointsToRedeem: pointsDiscountValue > 0 ? pointsToRedeem : 0,
        pointsDiscountValue,
        cardData:
          paymentMethod === 'CREDIT_CARD'
            ? {
                holderName: cardData.holderName,
                number: cleanDigits(cardData.number),
                expiryMonth,
                expiryYear: fullExpiryYear,
                ccv: cardData.ccv,
                installments: selectedInstallment,
              }
            : undefined,
        items: items.map((i) => ({
          productID: i.productId,
          productName: i.productName || i.name,
          quantity: i.quantity,
          price: i.price,
          color: i.color,
          size: i.size,
        })),
      }

      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || result.message || 'Falha ao processar o pedido.')
      }

      toast.success('Pedido registrado com sucesso!')
      onOrderCreated(result)
    } catch (err: any) {
      console.error('[CHECKOUT_SUBMIT_ERROR]', err)
      setError(err.message || 'Erro inesperado ao registrar o pedido. Tente novamente.')
      toast.error(err.message || 'Erro ao processar checkout.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Grid de 2 Colunas Canônico do Redesign Continental */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: STEPPER & FORMULÁRIO (7 Colunas no Desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Stepper Navigation */}
          <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { s: 1, label: '01. Identificação' },
                { s: 2, label: '02. Entrega' },
                { s: 3, label: '03. Pagamento' },
              ].map(({ s, label }) => {
                const isActive = step === s
                const isPassed = step > s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (isPassed) setStep(s as Step)
                    }}
                    disabled={!isPassed && !isActive}
                    className={`py-3 px-2 sm:px-4 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-1 font-mono text-xs ${
                      isActive
                        ? 'bg-catalog-gold/20 text-catalog-gold font-bold border-2 border-catalog-gold shadow-[0_0_20px_rgba(240,180,14,0.25)]'
                        : isPassed
                        ? 'bg-[#0B132B]/70 text-slate-300 border border-catalog-gold/30 hover:border-catalog-gold/60 cursor-pointer'
                        : 'bg-[#050B14]/60 text-catalog-muted border border-white/5 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="uppercase tracking-wider">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Banner de Erro */}
          {error && (
            <div className="animate-in fade-in duration-300">
              <AlertBanner variant="error" message={error} />
            </div>
          )}

          {/* STEP 1: DADOS PESSOAIS */}
          {step === 1 && (
            <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white uppercase font-mono tracking-wider">
                    Dados Pessoais & Contato
                  </h3>
                  <p className="text-xs text-catalog-muted font-light mt-0.5">
                    Informações para nota fiscal eletrônica e envio do pedido.
                  </p>
                </div>
                <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded">
                  Etapa 01/03
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                  Nome Completo
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
                  placeholder="Como no documento oficial"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                    E-mail
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
                    placeholder="seu.email@exemplo.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold font-mono transition-all"
                    placeholder="(11) 90000-0000"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                  CPF ou CNPJ
                </label>
                <input
                  type="text"
                  name="cpfCnpj"
                  value={formData.cpfCnpj}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cpfCnpj: formatCpfCnpj(e.target.value),
                    }))
                  }
                  className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold font-mono transition-all"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  maxLength={18}
                />
                <p className="text-[11px] text-catalog-muted font-mono mt-1">
                  Exigência do Banco Central e emissão de cobranças automotivas seguras.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: ENTREGA & FRETE */}
          {step === 2 && (
            <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white uppercase font-mono tracking-wider">
                    Modalidade de Entrega & Frete
                  </h3>
                  <p className="text-xs text-catalog-muted font-light mt-0.5">
                    Escolha como deseja receber ou retirar seus produtos.
                  </p>
                </div>
                <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded">
                  Etapa 02/03
                </span>
              </div>

              {/* Seletor de Tipo de Envio */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                  Forma de Envio
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'DELIVERY', label: 'Receber em Casa', desc: 'Correios ou J&T Express', icon: Truck },
                    { id: 'PICKUP', label: 'Retirar na Loja', desc: 'Grátis no Balcão', icon: Store },
                    { id: 'NONE', label: 'A Combinar', desc: 'Acertar via WhatsApp', icon: MessageSquare },
                  ].map((type) => {
                    const isSelected = formData.deliveryType === type.id
                    const IconComponent = type.icon
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, deliveryType: type.id as any }))
                          if (type.id !== 'DELIVERY') setSelectedFreight(null)
                        }}
                        className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-catalog-gold/20 border-catalog-gold text-white shadow-[0_0_15px_rgba(240,180,14,0.2)]'
                            : 'bg-[#0B132B]/50 border-catalog-gold/20 text-catalog-muted hover:border-catalog-gold/50 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <IconComponent className={`w-5 h-5 ${isSelected ? 'text-catalog-gold' : 'text-catalog-muted'}`} />
                          {isSelected && <span className="w-2 h-2 rounded-full bg-catalog-gold shadow-[0_0_6px_#F0B40E]" />}
                        </div>
                        <span className="font-bold text-xs uppercase font-mono tracking-wider block">{type.label}</span>
                        <span className="text-[11px] text-catalog-muted mt-1 font-mono leading-tight">{type.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Formulário de Endereço quando Entrega */}
              {formData.deliveryType === 'DELIVERY' && (
                <div className="space-y-4 pt-3 border-t border-catalog-gold/20">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                        CEP de Destino
                      </label>
                      {(isFetchingCep || isFetchingFreight) && (
                        <span className="text-xs text-catalog-gold font-mono flex items-center gap-1.5">
                          <Spinner className="h-3 w-3" /> Calculando frete e rota...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      name="address.cep"
                      value={formData.address.cep}
                      onChange={handleCepChange}
                      className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold font-mono transition-all"
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>

                  {/* Opções de Frete Calculadas */}
                  {freightOptions.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-catalog-gold font-bold">
                        Opções de Envio Disponíveis
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
                              className={`p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-2 border-catalog-gold bg-catalog-gold/20 shadow-[0_0_15px_rgba(240,180,14,0.2)]'
                                  : 'border-catalog-gold/30 bg-[#0B132B]/60 hover:border-catalog-gold/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected ? 'border-catalog-gold bg-catalog-gold' : 'border-catalog-gold/40'
                                  }`}
                                >
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#010E31]" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs uppercase font-mono text-white tracking-wide">
                                      {opt.serviceName}
                                    </span>
                                    {opt.isRecommended && (
                                      <span className="text-[10px] text-catalog-gold uppercase tracking-wider font-mono font-bold border border-catalog-gold/45 bg-catalog-gold/15 px-2 py-0.5 rounded-full">
                                        Recomendado
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-mono text-catalog-muted mt-0.5">
                                    {opt.deliveryTimeInDays > 0
                                      ? `Prazo previsto: ${opt.deliveryTimeInDays} dias úteis`
                                      : opt.description || 'Entrega rápida'}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-sm text-white">
                                {opt.price === 0 ? (
                                  <span className="text-emerald-400 font-bold">Grátis</span>
                                ) : (
                                  `R$ ${opt.price.toFixed(2)}`
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campos de Logradouro */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Estado</label>
                      <input
                        type="text"
                        name="address.state"
                        value={formData.address.state}
                        onChange={handleInputChange}
                        className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                        placeholder="UF"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Cidade</label>
                      <input
                        type="text"
                        name="address.city"
                        value={formData.address.city}
                        onChange={handleInputChange}
                        className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                        placeholder="Cidade"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Bairro</label>
                    <input
                      type="text"
                      name="address.neighborhood"
                      value={formData.address.neighborhood}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                      placeholder="Bairro"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Rua / Logradouro</label>
                      <input
                        type="text"
                        name="address.street"
                        value={formData.address.street}
                        onChange={handleInputChange}
                        className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                        placeholder="Av., Rua, Travessa..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Número</label>
                      <input
                        type="text"
                        name="address.number"
                        value={formData.address.number}
                        onChange={handleInputChange}
                        className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                        placeholder="Nº"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Complemento (Opcional)</label>
                    <input
                      type="text"
                      name="address.complement"
                      value={formData.address.complement}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                      placeholder="Apto, Bloco, Galpão..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: FORMA DE PAGAMENTO */}
          {step === 3 && (
            <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white uppercase font-mono tracking-wider">
                    Forma de Pagamento
                  </h3>
                  <p className="text-xs text-catalog-muted font-light mt-0.5">
                    Ambiente criptografado com tecnologia oficial do Banco Central.
                  </p>
                </div>
                <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded">
                  Etapa 03/03
                </span>
              </div>

              {/* Widget de Fidelidade e Resgate de Pontos */}
              <LoyaltyPointsWidget
                lojaID={lojaID}
                subtotal={subtotal}
                onPointsApplied={({ pointsToRedeem, discountValue }) => {
                  setPointsToRedeem(pointsToRedeem)
                  setPointsDiscountValue(discountValue)
                }}
              />

              {/* Grid Canônico de 3 Abas Seletores de Pagamento */}
              <div className="space-y-3">
                <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                  Escolha o Método de Pagamento
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {/* Aba 1: PIX */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'PIX'
                        ? 'bg-catalog-gold/20 border-2 border-catalog-gold text-white shadow-[0_0_20px_rgba(240,180,14,0.25)]'
                        : 'bg-[#0B132B]/50 border border-catalog-gold/20 text-catalog-muted hover:border-catalog-gold/50 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-6 h-6 text-catalog-gold" />
                    <span className="font-bold text-xs uppercase font-mono tracking-wider">PIX</span>
                    <span className="text-[10px] font-mono text-emerald-400">Imediato</span>
                  </button>

                  {/* Aba 2: Cartão de Crédito */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'bg-catalog-gold/20 border-2 border-catalog-gold text-white shadow-[0_0_20px_rgba(240,180,14,0.25)]'
                        : 'bg-[#0B132B]/50 border border-catalog-gold/20 text-catalog-muted hover:border-catalog-gold/50 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 text-catalog-gold" />
                    <span className="font-bold text-xs uppercase font-mono tracking-wider">Cartão</span>
                    <span className="text-[10px] font-mono text-catalog-muted">Até 12x</span>
                  </button>

                  {/* Aba 3: Boleto Bancário */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BOLETO')}
                    className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'BOLETO'
                        ? 'bg-catalog-gold/20 border-2 border-catalog-gold text-white shadow-[0_0_20px_rgba(240,180,14,0.25)]'
                        : 'bg-[#0B132B]/50 border border-catalog-gold/20 text-catalog-muted hover:border-catalog-gold/50 hover:text-white'
                    }`}
                  >
                    <FileText className="w-6 h-6 text-catalog-gold" />
                    <span className="font-bold text-xs uppercase font-mono tracking-wider">Boleto</span>
                    <span className="text-[10px] font-mono text-catalog-muted">D+1</span>
                  </button>
                </div>
              </div>

              {/* CONTEÚDO DA ABA SELECIONADA */}

              {/* PIX */}
              {paymentMethod === 'PIX' && (
                <div className="p-5 bg-[#0B132B]/80 border border-catalog-gold/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Pagamento Instantâneo via QR Code & Copia e Cola</span>
                  </div>
                  <p className="text-xs text-catalog-muted font-light leading-relaxed pl-6">
                    Após finalizar o pedido, o QR Code dinâmico oficial do Banco Central será exibido com confirmação automática imediata.
                  </p>
                </div>
              )}

              {/* CARTÃO DE CRÉDITO */}
              {paymentMethod === 'CREDIT_CARD' && (
                <div className="p-6 bg-[#0B132B]/80 border border-catalog-gold/30 rounded-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-catalog-gold/20">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono text-catalog-muted uppercase">Ambiente Seguro PCI-DSS</span>
                    </div>
                    {detectedCardBrand && (
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${detectedCardBrand.color}`}>
                        {detectedCardBrand.name}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Número do Cartão</label>
                    <input
                      type="text"
                      value={cardData.number}
                      onChange={handleCardNumberChange}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      className="w-full bg-[#050B14] border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Nome no Cartão</label>
                    <input
                      type="text"
                      value={cardData.holderName}
                      onChange={(e) => setCardData((prev) => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
                      placeholder="NOME COMO NO CARTÃO"
                      className="w-full bg-[#050B14] border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold uppercase font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Validade (MM/AA)</label>
                      <input
                        type="text"
                        value={cardData.expiryDate}
                        onChange={handleCardExpiryChange}
                        placeholder="MM/AA"
                        maxLength={5}
                        className="w-full bg-[#050B14] border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">CVV</label>
                      <input
                        type="password"
                        value={cardData.ccv}
                        onChange={handleCardCcvChange}
                        placeholder="123"
                        maxLength={4}
                        className="w-full bg-[#050B14] border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">Número de Parcelas</label>
                    <select
                      value={selectedInstallment}
                      onChange={(e) => setSelectedInstallment(parseInt(e.target.value, 10))}
                      className="w-full bg-[#050B14] border border-catalog-gold/30 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold cursor-pointer font-mono"
                    >
                      {installmentOptions.map((opt) => (
                        <option key={opt.count} value={opt.count} className="bg-[#050B14] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* BOLETO BANCÁRIO */}
              {paymentMethod === 'BOLETO' && (
                <div className="p-5 bg-[#0B132B]/80 border border-catalog-gold/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-catalog-gold font-mono text-xs font-bold uppercase">
                    <AlertCircle className="w-4 h-4 shrink-0 text-catalog-gold" />
                    <span>Vencimento em 1 Dia Útil (D+1)</span>
                  </div>
                  <ul className="text-xs font-mono text-catalog-muted pl-6 list-disc space-y-1">
                    <li>O boleto oficial Asaas e a linha digitável serão gerados na tela de confirmação.</li>
                    <li>Compensação bancária oficial em até 3 dias úteis pelo Banco Central.</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA (STICKY): RESUMO DO PEDIDO E TOTALIZADOR (5 Colunas no Desktop) */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="bg-catalog-card border border-catalog-gold/45 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-6">
            {/* Header do Resumo */}
            <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-catalog-gold" />
                <span>Resumo do Pedido</span>
              </h3>
              <span className="text-[10px] text-catalog-gold uppercase tracking-wider font-mono font-bold border border-catalog-gold/45 px-2.5 py-0.5 rounded-full">
                {items.reduce((acc, i) => acc + i.quantity, 0)} {items.reduce((acc, i) => acc + i.quantity, 0) === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {/* Lista de Produtos com Palco Branco Canônico */}
            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const itemImg = item.imageUrl || item.image
                const title = item.productName || item.name

                return (
                  <div key={idx} className="flex items-center gap-3.5 py-1">
                    {/* Palco Branco do Produto */}
                    <div className="w-14 h-14 bg-white rounded-xl p-1.5 object-contain shrink-0 shadow-sm border border-white/10 flex items-center justify-center overflow-hidden">
                      {itemImg ? (
                        <img
                          src={itemImg}
                          alt={title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-800" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate uppercase tracking-tight">
                        {title}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-xs font-mono text-catalog-muted">
                        <span>Qtd: {item.quantity}</span>
                        <span className="text-white font-semibold">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Linhas Contábeis */}
            <div className="space-y-2.5 pt-4 border-t border-catalog-gold/20 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-catalog-muted uppercase">Subtotal dos Produtos</span>
                <span className="text-white font-semibold">R$ {subtotal.toFixed(2)}</span>
              </div>

              {pointsDiscountValue > 0 && (
                <div className="flex justify-between items-center text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                  <span className="uppercase">Desconto Fidelidade ({pointsToRedeem} pts)</span>
                  <span className="font-bold">- R$ {pointsDiscountValue.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-catalog-muted uppercase">
                  Frete ({formData.deliveryType === 'PICKUP' ? 'Retirada' : selectedFreight?.serviceName || 'Envio'})
                </span>
                <span className="font-semibold text-white">
                  {calculatedFreightCost === 0 ? (
                    <span className="text-emerald-400 font-bold uppercase">Grátis</span>
                  ) : (
                    `R$ ${calculatedFreightCost.toFixed(2)}`
                  )}
                </span>
              </div>

              {/* Total Geral com Destaque Dourado */}
              <div className="pt-3 border-t border-catalog-gold/30 flex justify-between items-baseline">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-catalog-gold block font-bold">
                    Total do Pedido
                  </span>
                  {paymentMethod === 'CREDIT_CARD' && selectedInstallmentDetail && selectedInstallmentDetail.count > 1 && (
                    <span className="text-[11px] text-catalog-muted font-mono block">
                      Em {selectedInstallmentDetail.count}x de R$ {selectedInstallmentDetail.installmentValue.toFixed(2)}
                    </span>
                  )}
                </div>
                <span className="text-2xl sm:text-3xl font-bold font-mono text-catalog-gold tracking-tight">
                  {paymentMethod === 'CREDIT_CARD' && selectedInstallmentDetail?.hasInterest
                    ? `R$ ${selectedInstallmentDetail.totalWithInterest.toFixed(2)}`
                    : `R$ ${grandTotal.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Botão de Ação Principal Shimmer Canônico */}
            <div className="pt-2 space-y-3">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isFetchingFreight || isFetchingCep}
                  className="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] border border-[#F5BD1E]/40 flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.01]"
                >
                  {(isFetchingFreight || isFetchingCep) ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      <span>{step === 1 ? 'Avançar para Entrega' : 'Avançar para Pagamento'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] border border-[#F5BD1E]/40 flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.01]"
                >
                  {isLoading ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>
                        {paymentMethod === 'PIX'
                          ? 'Confirmar e Pagar via PIX'
                          : paymentMethod === 'CREDIT_CARD'
                          ? `Pagar R$ ${
                              selectedInstallmentDetail?.hasInterest
                                ? selectedInstallmentDetail.totalWithInterest.toFixed(2)
                                : grandTotal.toFixed(2)
                            } no Cartão`
                          : 'Gerar Boleto Bancário'}
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Botão Voltar Etapa */}
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center text-catalog-muted hover:text-white transition-colors group cursor-pointer py-1 disabled:opacity-50"
                >
                  <span className="group-hover:-translate-x-1 transition-transform duration-300">
                    <ArrowLeft className="w-4 h-4 text-catalog-gold" />
                  </span>
                  <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
                    Retornar para a etapa anterior
                  </span>
                </button>
              )}
            </div>

            {/* Selo de Segurança */}
            <div className="pt-2 border-t border-catalog-gold/15 flex items-center justify-center gap-2 text-[10px] font-mono text-catalog-muted uppercase tracking-wider text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-catalog-gold shrink-0" />
              <span>Checkout 100% Criptografado & Protegido</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
