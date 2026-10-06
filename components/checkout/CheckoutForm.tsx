'use client'

import type { proposalDTO } from '@/services/checkout-intent.service'
import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { AsyncRevision } from '@/lib/commerce/async-revision'
import { freightClientRequestSchema, freightClientResponseSchema } from '@/lib/commerce/freight-contract'
import { checkoutAddressSchema } from '@/lib/commerce/checkout-address'
import { BillingAddressFields, emptyCheckoutAddress } from './BillingAddressFields'
import { useCartStore } from '@/store/cart.store'
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
import type { PaymentConfig } from '@/lib/config/payment.config'

export interface CartItem {
  productId?: string
  productID?: string
  variantId?: string
  variantID?: string
  name?: string
  productName?: string
  quantity: number
  price: number
  color?: string
  size?: string
  imageUrl?: string
  image?: string
}

export type CheckoutResult = import('@/services/checkout.service').CreateOrderResult['order']

export interface CheckoutFormProps {
  lojaID: string
  pixKey: string
  whatsappNumber: string
  cartID?: string
  cartVersion?: number
  sourcePending?: boolean
  items?: CartItem[]
  onOrderCreated: (result: CheckoutResult) => void
}

type Step = 1 | 2 | 3
export type PaymentMethodTab = 'PIX' | 'WHATSAPP_PIX' | 'CREDIT_CARD' | 'BOLETO'

export function CheckoutForm({
  lojaID,
  pixKey,
  whatsappNumber,
  cartID,
  cartVersion,
  sourcePending = false,
  items = [],
  onOrderCreated,
}: CheckoutFormProps) {
  const [review, setReview] = useState<ReturnType<typeof proposalDTO> | null>(null)
  const reviewDraft = useRef<string | null>(null)
  const reviewDeadline = useRef(0)
  const quoteDeadlines = useRef(new Map<string, number>())
  const [step, setStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cepRevision = useRef(new AsyncRevision())
  const freightRevision = useRef(new AsyncRevision())
  const proposalRevision = useRef(new AsyncRevision())
  const editedAddressFields = useRef(new Set<string>())
  const submitting = useRef(false)
  const mounted = useRef(true)
  const invalidateReview = () => { proposalRevision.current.invalidate(); reviewDraft.current = null; setReview(null) }
  const invalidateFreight = () => { freightRevision.current.invalidate(); setSelectedFreight(null); setFreightOptions([]) }
  useEffect(() => {
    const cep = cepRevision.current, freight = freightRevision.current, proposal = proposalRevision.current
    mounted.current = true
    return () => { mounted.current = false; cep.invalidate(); freight.invalidate(); proposal.invalidate() }
  }, [])

  // Estados de Frete
  const [freightOptions, setFreightOptions] = useState<FreightOption[]>([])
  const [selectedFreight, setSelectedFreight] = useState<FreightOption | null>(null)
  const [isFetchingFreight, setIsFetchingFreight] = useState(false)
  const [isFetchingCep, setIsFetchingCep] = useState(false)
  const [freightState, setFreightState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'expired'>('idle')
  const [freightError, setFreightError] = useState<string | null>(null)
  const [freightRefresh, setFreightRefresh] = useState(0)
  const [billingAddress, setBillingAddress] = useState(emptyCheckoutAddress)
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(false)

  // Estados de Fidelidade / Pontos
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0)
  const [pointsDiscountValue, setPointsDiscountValue] = useState<number>(0)
  const [pointsPending, setPointsPending] = useState(false)

  // Meio de Pagamento Selecionado
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodTab>('PIX')
  const [paymentCapabilities, setPaymentCapabilities] = useState<{ methods: PaymentMethodTab[]; maximumInstallments: number; config: PaymentConfig } | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/payment/capabilities', { cache: 'no-store' }).then(async res => {
      if (!res.ok) throw new Error('Pagamento temporariamente indisponível.')
      const data = await res.json()
      if (active) { setPaymentCapabilities(data); if (data.methods[0]) setPaymentMethod(data.methods[0]) }
    }).catch(() => { if (active) setError('Não foi possível verificar os meios de pagamento.') })
    return () => { active = false }
  }, [lojaID])

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
    () => Math.round(items.reduce((acc, item) => acc + item.price * item.quantity, 0) * 100) / 100,
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
    () => Math.round((subtotalAfterPoints + calculatedFreightCost) * 100) / 100,
    [subtotalAfterPoints, calculatedFreightCost]
  )

  // Opções de Parcelamento do Cartão de Crédito
  const installmentOptions: InstallmentOption[] = useMemo(() => {
    if (grandTotal <= 0) return []
    if (!paymentCapabilities) return []
    return calculateInstallmentOptions(grandTotal, { ...paymentCapabilities.config, installmentMaxCount: paymentCapabilities.maximumInstallments })
  }, [grandTotal, paymentCapabilities])

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
    invalidateReview()
    if (name.startsWith('address.')) { editedAddressFields.current.add(name.split('.')[1]); invalidateFreight() }
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
    invalidateReview()
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
    const raw = cleanDigits(e.target.value).slice(0, 8)
    const formatted = raw.length > 5 ? raw.slice(0,5) + '-' + raw.slice(5) : raw
    const request = cepRevision.current.begin()
    invalidateFreight(); invalidateReview(); editedAddressFields.current.clear()
    setIsFetchingCep(raw.length === 8)
    setFormData(prev => ({ ...prev, address: { ...prev.address, cep: formatted, state: '', city: '', street: '', neighborhood: '' } }))
    if (raw.length !== 8) return
    try {
      const res = await fetch('https://viacep.com.br/ws/' + raw + '/json/', { signal: request.signal })
      if (!res.ok) throw new Error('CEP indisponível. Preencha o endereço e tente novamente.')
      const data = await res.json()
      if (!request.current()) return
      if (data.erro || typeof data.uf !== 'string' || typeof data.localidade !== 'string') throw new Error('CEP não encontrado.')
      setFormData(prev => {
        const address = { ...prev.address }
        const derived = { state: data.uf, city: data.localidade, neighborhood: data.bairro ?? '', street: data.logradouro ?? '' }
        for (const key of ['state','city','neighborhood','street'] as const) if (!editedAddressFields.current.has(key)) address[key] = derived[key]
        return { ...prev, address }
      })
    } catch (error) { if (request.current()) setError(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.') }
    finally { if (request.current()) setIsFetchingCep(false) }
  }

  // Every source, merchandise, address and delivery change revokes the quote.
  useEffect(() => {
    const gate = freightRevision.current
    const request = gate.begin()
    setSelectedFreight(null); setFreightOptions([]); setFreightError(null)
    const cep = cleanDigits(formData.address.cep)
    if (formData.deliveryType !== 'DELIVERY' || cep.length !== 8 || !items.length) {
      setFreightState('idle'); setIsFetchingFreight(false); return () => gate.invalidate()
    }
    setFreightState('loading'); setIsFetchingFreight(true)
    const timer = setTimeout(async () => {
      try {
        const payload = freightClientRequestSchema.parse({ lojaID, destinationCep: cep, deliveryType: 'DELIVERY',
          items: items.map(i => ({ productId: i.productId || i.productID, variantId: i.variantId || i.variantID, quantity: i.quantity })) })
        const requestStartedAt = performance.now()
        const res = await fetch('/api/freight/calculate', { method: 'POST', signal: request.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const raw = await res.json()
        if (!request.current()) return
        if (!res.ok) throw new Error(raw.error || 'Não foi possível cotar o frete.')
        const data = freightClientResponseSchema.parse(raw).data
        if (Number(data.merchandiseSubtotal) !== subtotal) {
          void useCartStore.getState().fetchCart().catch(() => {})
          throw new Error('Preços alterados. Atualize o carrinho antes de continuar.')
        }
        const serverNow = new Date(data.serverTime).getTime(), received = performance.now()
        quoteDeadlines.current.clear()
        for (const option of data.options) quoteDeadlines.current.set(option.freightQuoteToken, requestStartedAt + new Date(option.expiresAt).getTime() - serverNow)
        const options = data.options.filter(option => quoteDeadlines.current.get(option.freightQuoteToken)! > received)
        setFreightOptions(options); setFreightState(options.length ? 'ready' : 'empty')
        setSelectedFreight(options.find(o => o.isRecommended) ?? options[0] ?? null)
      } catch (error) {
        if (request.current()) { setFreightState('error'); setFreightError(error instanceof Error ? error.message : 'Falha na cotação.'); setSelectedFreight(null) }
      } finally { if (request.current()) setIsFetchingFreight(false) }
    }, 350)
    return () => { clearTimeout(timer); gate.invalidate() }
  }, [lojaID, cartID, cartVersion, formData.address, formData.deliveryType, items, subtotal, freightRefresh])

  useEffect(() => {
    if (!selectedFreight?.expiresAt) return
    const timer = setTimeout(() => { setSelectedFreight(null); setFreightOptions([]); setFreightState('expired') },
      Math.max(0, (quoteDeadlines.current.get(selectedFreight.freightQuoteToken!) ?? 0) - performance.now()))
    return () => clearTimeout(timer)
  }, [selectedFreight])

  useLayoutEffect(() => {
    proposalRevision.current.invalidate(); reviewDraft.current = null; setReview(null)
  }, [lojaID, cartID, cartVersion, items, formData, billingAddress, billingSameAsShipping, paymentMethod, selectedInstallment, pointsToRedeem, pointsDiscountValue, selectedFreight])

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
      if (!checkoutAddressSchema.safeParse(formData.address).success) { setError('Preencha o endereço de entrega completo, com CEP e UF válidos.'); return false }
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
      if (freightState !== 'ready' || !selectedFreight?.freightQuoteToken || (quoteDeadlines.current.get(selectedFreight.freightQuoteToken) ?? 0) <= performance.now()) {
        setError('Por favor, selecione uma modalidade de frete.')
        return false
      }
    }
    setError(null)
    return true
  }

  const validateStep3 = () => {
    if (['CREDIT_CARD', 'BOLETO'].includes(paymentMethod) && !checkoutAddressSchema.safeParse(billingSameAsShipping && formData.deliveryType === 'DELIVERY' ? formData.address : billingAddress).success) {
      setError('Preencha o endereço de cobrança completo nesta etapa.'); return false
    }
    if (paymentMethod === 'CREDIT_CARD') {
      if (!installmentOptions.some(option => option.count === selectedInstallment)) { setError('Selecione um plano de parcelas disponível.'); return false }
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
    if (sourcePending) { setError('Aguarde a atualização do carrinho.'); return }
    if (pointsPending) { setError('Aguarde a conferência dos pontos antes de revisar a compra.'); return }
    if (!paymentCapabilities?.methods.includes(paymentMethod)) { setError('Método de pagamento indisponível.'); return }
    if (submitting.current || !validateStep1() || !validateStep2() || !validateStep3()) return
    submitting.current = true
    const request = proposalRevision.current.begin()

    setIsLoading(true)
    setError(null)

    try {
      const [expiryMonth, expiryYear] = cardData.expiryDate.split('/')
      const fullExpiryYear = expiryYear ? `20${expiryYear}` : ''

      const payload = {
        lojaID,
        customer: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: cleanDigits(formData.phone),
          cpfCnpj: cleanDigits(formData.cpfCnpj),
        },
        deliveryType: formData.deliveryType,
        shippingAddress: formData.deliveryType === 'DELIVERY' ? formData.address : undefined,
        billingAddress: ['CREDIT_CARD', 'BOLETO'].includes(paymentMethod) && !(billingSameAsShipping && formData.deliveryType === 'DELIVERY') ? billingAddress : undefined,
        billingSameAsShipping: ['CREDIT_CARD', 'BOLETO'].includes(paymentMethod) && billingSameAsShipping && formData.deliveryType === 'DELIVERY',
        freightQuoteToken: formData.deliveryType === 'DELIVERY' ? selectedFreight?.freightQuoteToken : undefined,
        shippingCost: calculatedFreightCost,
        shippingProvider: selectedFreight?.providerId || undefined,
        shippingServiceName: selectedFreight?.serviceName || undefined,
        shippingEstimatedDays: selectedFreight?.deliveryTimeInDays || undefined,
        paymentMethod,
        pointsToRedeem: pointsDiscountValue > 0 ? pointsToRedeem : 0,
        installments: paymentMethod === 'CREDIT_CARD' ? selectedInstallment : 1,
        acceptedFinancialTotal: paymentMethod === 'CREDIT_CARD' ? selectedInstallmentDetail?.totalWithInterest : grandTotal,
        creditCard:
          paymentMethod === 'CREDIT_CARD'
            ? {
                holderName: cardData.holderName.trim().toUpperCase(),
                number: cleanDigits(cardData.number),
                expiryMonth: expiryMonth?.padStart(2, '0') || '',
                expiryYear: fullExpiryYear,
                ccv: cardData.ccv.trim(),
              }
            : undefined,
        items: items.map((i: any) => ({
          productId: i.productId || i.productID,
          variantId: i.variantId || i.variantID,
          name: i.name || i.productName || 'Produto',
          quantity: i.quantity,
          price: i.price,
          color: i.color,
          size: i.size,
        })),
      }

      const { creditCard: transientCard, ...draft } = { ...payload, cartID, cartVersion }
      const draftKey = JSON.stringify(draft)
      if (!review || reviewDraft.current !== draftKey) {
        const contextResponse = await fetch('/api/checkout/intents', { cache: 'no-store', signal: request.signal })
        if (!contextResponse.ok) throw new Error('Não foi possível recuperar a identidade da compra.')
        const context = (await contextResponse.json()).data
        const proposalStartedAt = performance.now()
        const proposalResponse = await fetch('/api/checkout/intents', {
          method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...draft, basketID: cartID ? undefined : context.basketID }),
        })
        const proposalResult = await proposalResponse.json()
        if (!proposalResponse.ok) throw new Error(proposalResult.error || 'Não foi possível revisar a compra.')
        if (!request.current() || !mounted.current) return
        const proposal = proposalResult.data as ReturnType<typeof proposalDTO>
        const recovered = await fetch('/api/checkout/intents/' + proposal.checkoutIntentID, { cache: 'no-store', signal: request.signal })
        if (!recovered.ok) throw new Error('Não foi possível verificar a compra existente.')
        const current = (await recovered.json()).data
        if (!request.current() || !mounted.current) return
        const url = new URL(window.location.href); url.searchParams.set('intent', proposal.checkoutIntentID)
        window.history.replaceState(null, '', url)
        if (current.result) { onOrderCreated(current.result.order); return }
        reviewDeadline.current = proposalStartedAt + new Date(proposal.expiresAt).getTime() - new Date(proposal.serverTime).getTime()
        reviewDraft.current = draftKey; setReview(proposal)
        return
      }
      if (reviewDeadline.current <= performance.now()) { invalidateReview(); setError('A proposta expirou. Revise os valores novamente.'); return }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutIntentID: review.checkoutIntentID,
          acceptedRevision: review.revision, acceptedContentHash: review.contentHash, creditCard: transientCard }),
      })

      // Tratamento resiliente de resposta (evita SyntaxError de JSON quando o servidor retorna HTML)
      const contentType = res.headers.get('content-type') || ''
      let result: any
      if (contentType.includes('application/json')) {
        result = await res.json()
      } else {
        throw new Error('Serviço de pagamento temporariamente indisponível. Tente novamente em instantes.')
      }

      if (!res.ok) {
        throw new Error(result.error || result.message || 'Falha ao processar o pedido.')
      }

      if (!request.current() || !mounted.current) return
      const orderData = result.data?.order || result.order || result

      if (!['CANCELLED', 'DECLINED', 'REVIEW'].includes(orderData.paymentState)) toast.success('Pedido registrado com sucesso!')
      onOrderCreated(orderData)
    } catch (err: any) {
      if (!request.current() || !mounted.current) return
      setError(err.message || 'Erro inesperado ao registrar o pedido. Tente novamente.')
      toast.error(err.message || 'Erro ao processar checkout.')
    } finally {
      submitting.current = false
      if (mounted.current) setIsLoading(false)
    }
  }

  return (
    <fieldset disabled={isLoading || sourcePending} className="w-full min-w-0">
    {sourcePending && <p role="status">Atualizando carrinho...</p>}
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
                          invalidateFreight(); invalidateReview(); cepRevision.current.invalidate(); setIsFetchingCep(false)
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

                  {['empty','error','expired'].includes(freightState) && <div role="alert" className="text-sm text-red-400">
                    <p>{freightError || (freightState === 'expired' ? 'A cotação expirou.' : 'Não há opção de entrega disponível para estes dados.')}</p>
                    <button type="button" onClick={() => setFreightRefresh(value => value + 1)}>Calcular frete novamente</button>
                  </div>}
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
                            <button
                              type="button"
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
                            </button>
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
                onPendingChange={setPointsPending}
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {paymentCapabilities?.methods.includes('WHATSAPP_PIX') && <button type="button" onClick={() => setPaymentMethod('WHATSAPP_PIX')}
                    className="rounded-xl p-4 border border-catalog-gold/30 text-xs text-white">PIX manual via WhatsApp<br />Confirmação pela loja</button>}
                  {/* Aba 1: PIX */}
                  <button
                    type="button"
                    disabled={!paymentCapabilities?.methods.includes('PIX')}
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
                    disabled={!paymentCapabilities?.methods.includes('CREDIT_CARD')}
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'bg-catalog-gold/20 border-2 border-catalog-gold text-white shadow-[0_0_20px_rgba(240,180,14,0.25)]'
                        : 'bg-[#0B132B]/50 border border-catalog-gold/20 text-catalog-muted hover:border-catalog-gold/50 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 text-catalog-gold" />
                    <span className="font-bold text-xs uppercase font-mono tracking-wider">Cartão</span>
                    <span className="text-[10px] font-mono text-catalog-muted">Até {paymentCapabilities?.maximumInstallments ?? 1}x</span>
                  </button>

                  {/* Aba 3: Boleto Bancário */}
                  <button
                    type="button"
                    disabled={!paymentCapabilities?.methods.includes('BOLETO')}
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

              {['BOLETO','CREDIT_CARD'].includes(paymentMethod) && <section className="space-y-4">
                {formData.deliveryType === 'DELIVERY' && <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={billingSameAsShipping} onChange={e => { invalidateReview(); setBillingSameAsShipping(e.target.checked) }} />
                  Usar endereço de entrega também para cobrança
                </label>}
                {!(billingSameAsShipping && formData.deliveryType === 'DELIVERY') && <BillingAddressFields value={billingAddress} onChange={value => { invalidateReview(); setBillingAddress(value) }} />}
              </section>}
              {paymentMethod === 'WHATSAPP_PIX' && <p className="text-sm text-catalog-muted">Pagamento manual com a chave da loja. A confirmação depende da conferência da loja.</p>}
              {!paymentCapabilities?.methods.length && <p className="text-sm text-red-400">Nenhum meio de pagamento disponível nesta loja.</p>}
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
                      {selectedInstallmentDetail.label}
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
                <div className="w-full space-y-4">
                {review && <section aria-live="polite" className="rounded-xl border border-catalog-gold p-4 text-sm space-y-2">
                  <h3>Revise a proposta antes de confirmar</h3>
                  <p>{review.proposal.customer.name} · {review.proposal.deliveryType} · {review.proposal.financial.method}</p>
                  {review.proposal.items.map(item => <p key={item.variantId}>{item.quantity} × {item.name} ({item.size}, {item.color}) — R$ {item.price}</p>)}
                  {review.proposal.shippingAddress && <p>Entrega: {review.proposal.shippingAddress.street}, {review.proposal.shippingAddress.number} · {review.proposal.shippingAddress.city}/{review.proposal.shippingAddress.state}</p>}
                  {review.proposal.billingAddress && <p>Cobrança: {review.proposal.billingAddress.street}, {review.proposal.billingAddress.number} · {review.proposal.billingAddress.city}/{review.proposal.billingAddress.state}</p>}
                  <p>Mercadorias: R$ {review.proposal.financial.merchandiseSubtotal} · Desconto: R$ {review.proposal.financial.loyaltyDiscount} ({review.proposal.pointsRedeemed} pontos)</p>
                  <p>Frete: R$ {review.proposal.financial.shippingCost} · Encargos: R$ {review.proposal.financial.financingCharge}</p>
                  <p>Total: R$ {review.proposal.financial.financialTotal} · Parcelas: {review.proposal.financial.installments.join(' + ')}</p>
                  <p>Ganho previsto: {review.proposal.earn.points} pontos · Válida até {new Date(review.expiresAt).toLocaleTimeString('pt-BR')}.</p>
                </section>}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || sourcePending || pointsPending}
                  className="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] border border-[#F5BD1E]/40 flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.01]"
                >
                  {isLoading ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>
                        {review ? 'Confirmar proposta e concluir compra' : 'Revisar proposta de compra'}
                      </span>
                    </>
                  )}
                </button>
                </div>
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
    </fieldset>
  )
}
