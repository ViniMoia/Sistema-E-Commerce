'use client'

import React, { useState, useMemo } from 'react'
import { Button, AlertBanner, Spinner } from '@/components/ui'

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
  freightValue: number | null
  pixKey: string | null
  customer: { name: string; phone: string }
  items: Array<{ name: string; quantity: number; price: number }>
  deliveryType: string
}

export interface CheckoutFormProps {
  lojaID: string
  pixKey: string
  whatsappNumber: string
  items?: CartItem[] // Passed via props as requested
  onOrderCreated: (result: CheckoutResult) => void
}

type Step = 1 | 2 | 3

export function CheckoutForm({ lojaID, pixKey, whatsappNumber, items = [], onOrderCreated }: CheckoutFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freightValue, setFreightValue] = useState<number | null>(null)
  const [isFetchingFreight, setIsFetchingFreight] = useState(false)

     const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryType: 'DELIVERY' as 'DELIVERY' | 'PICKUP',
    address: {
      state: '',
      city: '',
      neighborhood: '',
      street: '',
      number: '',
      complement: '',
      cep: ''
    }
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.startsWith('address.')) {
      const field = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [field]: value }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 11) val = val.slice(0, 11)
    if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`
    if (val.length > 10) val = `${val.slice(0, 10)}-${val.slice(10)}`
    setFormData(prev => ({ ...prev, phone: val }))
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 8) val = val.slice(0, 8)
    if (val.length > 5) val = `${val.slice(0, 5)}-${val.slice(5)}`
    setFormData(prev => ({ ...prev, address: { ...prev.address, cep: val } }))
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
      
      if (formData.deliveryType === 'DELIVERY') {
        setIsFetchingFreight(true)
        try {
          const res = await fetch(`/api/freight?lojaID=${lojaID}&cityName=${encodeURIComponent(formData.address.city)}`)
          if (res.ok) {
            const data = await res.json()
            setFreightValue(data.value)
          } else {
            setFreightValue(null)
          }
        } catch (e) {
          console.error(e)
          setFreightValue(null)
        } finally {
          setIsFetchingFreight(false)
        }
      } else {
        setFreightValue(0)
      }

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
          phone: formData.phone.replace(/\D/g, '')
        },
        items: items.map((item: any) => ({
          productId: item.productID || item.productId,
          name: item.productName || item.name,
          quantity: item.quantity,
          price: item.price,
          color: item.color,
          size: item.size
        })),
        deliveryType: formData.deliveryType,
        address: formData.deliveryType === 'DELIVERY' ? formData.address : undefined,
        freightValue: formData.deliveryType === 'PICKUP' ? 0 : (freightValue !== null ? freightValue : undefined),
        pixKey
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar o pedido.')
      }

      onOrderCreated(data.data.order)
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado.')
    } finally {
      setIsLoading(false)
    }
  }

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items])

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
                ${step >= s 
                  ? 'bg-[#dbb501] text-zinc-950 shadow-[0_0_15px_rgba(219,181,1,0.4)]' 
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span>Seus Dados</span>
          <span>Entrega</span>
          <span>Revisão</span>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {error && (
          <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
            <AlertBanner variant="error" message={error} />
          </div>
        )}

        <div className="min-h-[300px]">
          {/* STEP 1 */}
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

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, deliveryType: 'DELIVERY' }))}
                  className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                    formData.deliveryType === 'DELIVERY'
                      ? 'border-[#dbb501] bg-[#dbb501]/5 text-[#dbb501]'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="block font-medium">Entrega</span>
                  <span className="text-xs opacity-80 mt-1 block">Receber no endereço</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, deliveryType: 'PICKUP' }))}
                  className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                    formData.deliveryType === 'PICKUP'
                      ? 'border-[#dbb501] bg-[#dbb501]/5 text-[#dbb501]'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="block font-medium">Retirada</span>
                  <span className="text-xs opacity-80 mt-1 block">Buscar na loja</span>
                </button>
              </div>

              {formData.deliveryType === 'PICKUP' ? (
                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                    Você escolheu retirar o pedido na loja. Entraremos em contato pelo WhatsApp para combinar a retirada após a confirmação do pagamento.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">CEP</label>
                    <input
                      type="text"
                      name="address.cep"
                      value={formData.address.cep}
                      onChange={handleCepChange}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#dbb501]/50 focus:border-[#dbb501] transition-all"
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-4">Resumo do Pedido</h3>
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
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Frete</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right">
                      {formData.deliveryType === 'PICKUP' ? (
                        'Grátis'
                      ) : freightValue !== null ? (
                        `R$ ${freightValue.toFixed(2)}`
                      ) : (
                        <span className="text-xs text-[#dbb501]">Verificar o valor do frete pelo whats app</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Total Previsto</span>
                    <span className="font-bold text-[#dbb501] text-lg">R$ {(subtotal + (freightValue || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                  Após a confirmação, você será redirecionado para o WhatsApp para realizar o pagamento via PIX e finalizar o pedido.
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
            <Button onClick={nextStep} disabled={isFetchingFreight} className="bg-[#dbb501] hover:bg-[#dbb501]/90 text-zinc-950 px-8">
              {isFetchingFreight && <Spinner className="mr-2 h-4 w-4" />}
              Continuar
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-[#dbb501] hover:bg-[#dbb501]/90 text-zinc-950 px-8 shadow-[0_0_20px_rgba(219,181,1,0.3)]">
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              Confirmar e Pagar via PIX
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
