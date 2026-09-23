'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Button, AlertBanner, Spinner } from '@/components/ui'
import { FreightOption } from '@/types/freight'
import { LoyaltyPointsWidget } from './LoyaltyPointsWidget'
import { formatCpfCnpj, validateCpfCnpj, cleanDigits } from '@/lib/validators/cpf-cnpj'
import { calculateInstallmentOptions, type InstallmentOption } from '@/services/payment/installment.service'
import { validateLuhn } from '@/lib/validators/checkout.validators'
import { QrCode, CreditCard, FileText, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

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

  // Opções dinâmicas de parcelamento respeitando o valor mínimo da parcela (R$ 20,00)
  const installmentOptions: InstallmentOption[] = useMemo(() => {
    return calculateInstallmentOptions(grandTotal)
  }, [grandTotal])

  // Reseta parcelamento se o total mudar e exceder o máximo permitido
  useEffect(() => {
    if (installmentOptions.length > 0 && selectedInstallment > installmentOptions.length) {
      setSelectedInstallment(1)
    }
  }, [installmentOptions, selectedInstallment])

  const selectedInstallmentDetail = useMemo(() => {
    return installmentOptions.find((opt) => opt.count === selectedInstallment) || installmentOptions[0]
  }, [installmentOptions, selectedInstallment])

  // Detecção de bandeira de cartão
  const detectedCardBrand = useMemo(() => {
    const clean = cardData.number.replace(/\D/g, '')
    if (/^4/.test(clean)) return { name: 'Visa', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' }
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: 'Mastercard', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' }
    if (/^(4011|4389|4514|4576|5041|5067|5090|6277|6362|6363|650|651|655)/.test(clean)) return { name: 'Elo', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' }
    if (/^3[47]/.test(clean)) return { name: 'Amex', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' }
    if (/^(606282|3841)/.test(clean)) return { name: 'Hipercard', color: 'text-red-500 bg-red-500/10 border-red-500/30' }
    return null
  }, [cardData.number])

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

  // Manipuladores de Cartão com máscaras
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 16)
    const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ')
    setCardData((prev) => ({ ...prev, number: formatted }))
  }

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (val.length > 2) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`
    }
    setCardData((prev) => ({ ...prev, expiryDate: val }))
  }

  const handleCardCcvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCardData((prev) => ({ ...prev, ccv: val }))
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

          fetchFreightOptions(val)
        }
      } catch (err) {
        console.error('[VIACEP_ERROR]', err)
      } finally {
        setIsFetchingCep(false)
      }
    }
  }

  const nextStep = () => {
    setError(null)
    if (step === 1) {
      if (!formData.name.trim()) return setError('Nome completo é obrigatório.')
      if (!formData.email.trim() || !formData.email.includes('@')) return setError('E-mail válido é obrigatório.')
      if (!formData.phone.trim() || formData.phone.length < 14) return setError('Telefone com DDD é obrigatório.')
      if (!formData.cpfCnpj.trim()) return setError('CPF ou CNPJ é obrigatório para emissão da cobrança.')
      if (!validateCpfCnpj(formData.cpfCnpj)) return setError('CPF ou CNPJ inválido. Verifique os dígitos informados.')
    }

    if (step === 2) {
      if (formData.deliveryType === 'DELIVERY') {
        const { state, city, neighborhood, street, number, cep } = formData.address
        if (!cep || cep.replace(/\D/g, '').length !== 8) return setError('CEP válido é obrigatório.')
        if (!state.trim()) return setError('Estado é obrigatório.')
        if (!city.trim()) return setError('Cidade é obrigatória.')
        if (!neighborhood.trim()) return setError('Bairro é obrigatório.')
        if (!street.trim()) return setError('Rua é obrigatória.')
        if (!number.trim()) return setError('Número é obrigatório.')
        if (!selectedFreight) return setError('Por favor, selecione uma opção de frete.')
      }
    }

    setStep((prev) => Math.min(prev + 1, 3) as Step)
  }

  const prevStep = () => {
    setError(null)
    setStep((prev) => Math.max(prev - 1, 1) as Step)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Validação de piso mínimo do gateway Asaas (R$ 5,00)
      if (grandTotal < 5.0) {
        throw new Error(
          `O valor total do pedido (R$ ${grandTotal.toFixed(2)}) é inferior ao valor mínimo de R$ 5,00 exigido para processamento pelo gateway de pagamento.`
        )
      }

      // 2. Validações específicas do Cartão de Crédito
      let creditCardPayload: any = undefined
      if (paymentMethod === 'CREDIT_CARD') {
        if (!cardData.holderName.trim() || cardData.holderName.trim().length < 3) {
          throw new Error('Nome impresso no cartão deve ter no mínimo 3 caracteres.')
        }

        const rawNumber = cardData.number.replace(/\D/g, '')
        if (rawNumber.length < 13 || rawNumber.length > 19) {
          throw new Error('Número de cartão de crédito inválido.')
        }

        if (!validateLuhn(rawNumber)) {
          throw new Error('Número de cartão de crédito inválido (falha na validação dos dígitos).')
        }

        const expiryParts = cardData.expiryDate.split('/')
        if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
          throw new Error('Data de validade do cartão deve estar no formato MM/AA.')
        }

        const month = parseInt(expiryParts[0], 10)
        const year = parseInt('20' + expiryParts[1], 10)
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1

        if (month < 1 || month > 12) {
          throw new Error('Mês de validade inválido. Informe um valor de 01 a 12.')
        }

        if (year < currentYear || (year === currentYear && month < currentMonth)) {
          throw new Error('O cartão de crédito informado está expirado.')
        }

        if (!cardData.ccv.trim() || cardData.ccv.length < 3) {
          throw new Error('Código de segurança (CVV) deve ter 3 ou 4 dígitos.')
        }

        creditCardPayload = {
          holderName: cardData.holderName.trim().toUpperCase(),
          number: rawNumber,
          expiryMonth: String(month).padStart(2, '0'),
          expiryYear: String(year),
          ccv: cardData.ccv.trim(),
        }
      }

      // 3. Validação de endereço para Boleto
      if (paymentMethod === 'BOLETO' && formData.deliveryType !== 'DELIVERY') {
        if (!formData.address.cep || !formData.address.street || !formData.address.number) {
          throw new Error(
            'Para emissão de boleto bancário com retirada ou a combinar, é necessário preencher seu CEP e endereço para registro bancário.'
          )
        }
      }

      const payload = {
        lojaID,
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone.replace(/\D/g, ''),
          cpfCnpj: cleanDigits(formData.cpfCnpj),
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
        address: formData.deliveryType === 'DELIVERY' || paymentMethod === 'BOLETO' ? formData.address : undefined,
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
        paymentMethod,
        creditCard: creditCardPayload,
        installments: paymentMethod === 'CREDIT_CARD' ? selectedInstallment : 1,
        installmentValue:
          paymentMethod === 'CREDIT_CARD' && selectedInstallmentDetail
            ? selectedInstallmentDetail.installmentValue
            : undefined,
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
      const errorMsg = err.message || 'Ocorreu um erro inesperado ao finalizar o pedido.'
      setError(errorMsg)
      toast.error(errorMsg)
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
                    ? 'bg-[#dbb501] text-zinc-950 shadow-[0_0_15px_rgba(219,181,1,0.4)] font-bold'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                }`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs font-medium text-zinc-500">
          <span>Dados Pessoais</span>
          <span>Entrega & Frete</span>
          <span>Pagamento & Confirmação</span>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {error && (
          <div className="mb-6">
            <AlertBanner variant="error" message={error} />
          </div>
        )}

        {/* STEP 1: DADOS PESSOAIS */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome Completo</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                placeholder="Como no documento"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">WhatsApp / Telefone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">CPF ou CNPJ</label>
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
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all font-mono"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
              <p className="text-xs text-zinc-500">Obrigatório pelo Banco Central e Asaas para emissão de cobranças oficiais.</p>
            </div>
          </div>
        )}

        {/* STEP 2: ENTREGA & FRETE */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Forma de Envio</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'DELIVERY', label: 'Receber em Casa', desc: 'Envio Correios ou Transportadora' },
                  { id: 'PICKUP', label: 'Retirar na Loja', desc: 'Sem custo de envio' },
                  { id: 'NONE', label: 'A Combinar', desc: 'Frete combinado via WhatsApp' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, deliveryType: type.id as any }))
                      if (type.id !== 'DELIVERY') setSelectedFreight(null)
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      formData.deliveryType === type.id
                        ? 'border-[#dbb501] bg-[#dbb501]/10 text-zinc-900 dark:text-zinc-50 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="font-semibold text-sm">{type.label}</span>
                    <span className="text-[11px] text-zinc-500 mt-1 leading-tight">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {formData.deliveryType === 'DELIVERY' && (
              <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">CEP</label>
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

                {/* Opções de Frete */}
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
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
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
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {opt.price === 0 ? 'Grátis' : `R$ ${opt.price.toFixed(2)}`}
                            </span>
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

            {/* Resumo Financeiro */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Resumo do Pedido</h3>

              <div className="space-y-2.5 mb-4 max-h-48 overflow-y-auto pr-1">
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

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Subtotal dos Produtos</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">R$ {subtotal.toFixed(2)}</span>
                </div>

                {pointsDiscountValue > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                    <span className="font-medium">Desconto Fidelidade ({pointsToRedeem} pts)</span>
                    <span className="font-bold font-mono">- R$ {pointsDiscountValue.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Frete ({formData.deliveryType === 'PICKUP' ? 'Retirada' : selectedFreight?.serviceName || 'Envio'}):
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {calculatedFreightCost === 0 ? (
                      <span className="text-emerald-500 font-bold">Grátis</span>
                    ) : (
                      `R$ ${calculatedFreightCost.toFixed(2)}`
                    )}
                  </span>
                </div>

                <div className="flex justify-between pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Total do Pedido</span>
                  <span className="font-bold text-[#dbb501] text-xl">
                    {paymentMethod === 'CREDIT_CARD' && selectedInstallmentDetail?.hasInterest
                      ? `R$ ${selectedInstallmentDetail.totalWithInterest.toFixed(2)}`
                      : `R$ ${grandTotal.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* SELETOR DE MEIOS DE PAGAMENTO (3 ABAS) */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Selecione a Forma de Pagamento
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                {/* Aba 1: PIX */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PIX')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    paymentMethod === 'PIX'
                      ? 'border-[#dbb501] bg-[#dbb501]/10 text-zinc-950 dark:text-zinc-50 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <QrCode className="w-5 h-5 text-[#dbb501]" />
                    <span className="font-bold text-sm">PIX</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Aprovação Imediata</span>
                </button>

                {/* Aba 2: Cartão de Crédito */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'border-[#dbb501] bg-[#dbb501]/10 text-zinc-950 dark:text-zinc-50 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <CreditCard className="w-5 h-5 text-[#dbb501]" />
                    <span className="font-bold text-sm">Cartão</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">Até 12x</span>
                </button>

                {/* Aba 3: Boleto Bancário */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BOLETO')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    paymentMethod === 'BOLETO'
                      ? 'border-[#dbb501] bg-[#dbb501]/10 text-zinc-950 dark:text-zinc-50 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="w-5 h-5 text-[#dbb501]" />
                    <span className="font-bold text-sm">Boleto</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">Vence em 1 dia</span>
                </button>
              </div>

              {/* CONTEÚDO DA ABA SELECIONADA */}

              {/* CONTEÚDO PIX */}
              {paymentMethod === 'PIX' && (
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Pagamento instantâneo via QR Code e Copia e Cola</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-6">
                    Após confirmar, o QR Code dinâmico do Banco Central será gerado na tela com baixa imediata do pedido.
                  </p>
                </div>
              )}

              {/* CONTEÚDO CARTÃO DE CRÉDITO */}
              {paymentMethod === 'CREDIT_CARD' && (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-zinc-500 font-medium">Ambiente Seguro PCI-DSS (Criptografado)</span>
                    </div>
                    {detectedCardBrand && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${detectedCardBrand.color}`}>
                        {detectedCardBrand.name}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Número do Cartão
                    </label>
                    <input
                      type="text"
                      value={cardData.number}
                      onChange={handleCardNumberChange}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] font-mono transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Nome Impresso no Cartão
                    </label>
                    <input
                      type="text"
                      value={cardData.holderName}
                      onChange={(e) => setCardData((prev) => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
                      placeholder="NOME COMO NO CARTÃO"
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] uppercase transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        Validade (MM/AA)
                      </label>
                      <input
                        type="text"
                        value={cardData.expiryDate}
                        onChange={handleCardExpiryChange}
                        placeholder="MM/AA"
                        maxLength={5}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] font-mono transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        Código CVV
                      </label>
                      <input
                        type="password"
                        value={cardData.ccv}
                        onChange={handleCardCcvChange}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] font-mono transition-all"
                      />
                    </div>
                  </div>

                  {/* Seletor de Parcelas */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Número de Parcelas
                    </label>
                    <select
                      value={selectedInstallment}
                      onChange={(e) => setSelectedInstallment(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all cursor-pointer font-medium text-sm"
                    >
                      {installmentOptions.map((opt) => (
                        <option key={opt.count} value={opt.count}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-zinc-500">Parcela mínima de R$ 20,00.</p>
                  </div>
                </div>
              )}

              {/* CONTEÚDO BOLETO BANCÁRIO */}
              {paymentMethod === 'BOLETO' && (
                <div className="p-4 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Vencimento em 1 dia útil (D+1)</span>
                  </div>
                  <ul className="text-xs text-zinc-600 dark:text-zinc-400 pl-6 list-disc space-y-1">
                    <li>O boleto e a linha digitável serão gerados instantaneamente na próxima tela.</li>
                    <li>Compensação bancária oficial em até 3 dias úteis após o pagamento.</li>
                    <li>Os produtos comprados serão despachados logo após a compensação do boleto.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

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
              className="bg-[#dbb501] hover:bg-[#dbb501]/90 text-zinc-950 px-8 shadow-[0_0_20px_rgba(219,181,1,0.3)] font-semibold transition-all hover:scale-[1.02]"
            >
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {paymentMethod === 'PIX'
                ? 'Confirmar e Pagar via PIX'
                : paymentMethod === 'CREDIT_CARD'
                ? `Pagar R$ ${
                    selectedInstallmentDetail?.hasInterest
                      ? selectedInstallmentDetail.totalWithInterest.toFixed(2)
                      : grandTotal.toFixed(2)
                  } no Cartão`
                : 'Gerar Boleto Bancário'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
