'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart.store';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { Button, Spinner } from '@/components/ui';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useCartStore();
  const items = cart?.items || [];
  const [loja, setLoja] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = process.env.NEXT_PUBLIC_LOJA_SLUG || 'loja-padrao';
    fetchLojaSettings(slug);
  }, []);

  const fetchLojaSettings = async (slug: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/loja/${slug}`);
      
      if (!res.ok) {
        setError('Loja não encontrada');
        setLoading(false);
        return;
      }
      
      const lojaData = await res.json();
      
      setLoja(lojaData);
      setLoading(false);
    } catch (err) {
      console.error('[CHECKOUT_PAGE_ERROR]', err);
      setError('Erro ao carregar configurações da loja');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-xs text-neutral-400">Carregando checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <Button 
            variant="outline"
            onClick={() => router.push('/')}
            className="mt-4"
          >
            Voltar para Home
          </Button>
        </div>
      </div>
    );
  }

  if (!loja) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-yellow-500">Configurando loja...</p>
          <Spinner className="h-6 w-6 ml-2" />
        </div>
      </div>
    );
  }

  // Handle form submission
  const handleOrderCreated = (result: any) => {
    // Store order data in sessionStorage for confirmation page
    sessionStorage.setItem('last_order', JSON.stringify({
      orderNumber: result.orderNumber,
      customer: {
        name: result.customer.name,
        phone: result.customer.phone
      },
      items: result.items,
      deliveryType: result.deliveryType,
      address: result.address || undefined,
      freightValue: result.freightValue,
      total: result.total,
      pixKey: result.pixKey,
      whatsappNumber: loja.whatsappNumber || ''
    }));
    
    router.push('/checkout/confirmation');
  };

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
        <div className="w-full max-w-[450px] space-y-6">
          {/* Logo / Brand */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative w-16 h-16 bg-[radial-gradient(800px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(219,181,1,0.08),transparent_40%)] 
                             flex items-center justify-center rounded-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(219,181,1,0.03),transparent_60%)] 
                               rounded-2xl" />
              <span className="relative z-10 text-[#dbb501] font-bold text-2xl">{loja?.name ? loja.name.substring(0, 2).toUpperCase() : 'LOJA'}</span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              Finalizar Pedido
            </h2>
            <p className="text-sm text-neutral-400">
              Preencha os dados abaixo para concluir sua compra via PIX
            </p>
          </div>

          {/* Checkout Form */}
          <CheckoutForm 
            lojaID={loja.id}
            pixKey={loja.pixKey || ''}
            whatsappNumber={loja.whatsappNumber || ''}
            items={items as any}
            onOrderCreated={handleOrderCreated}
          />

          {/* Footer links */}
          <div className="mt-8 text-center text-xs text-neutral-500">
            <p>
              Pagamento via PIX. Após a confirmação, você será redirecionado para o WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-[10] mt-auto">
        <div className="border-t border-neutral-800/20"></div>
        <div className="px-4 py-6 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} {loja?.name || 'Loja'}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}