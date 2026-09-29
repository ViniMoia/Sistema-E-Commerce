import { notFound } from 'next/navigation'
import { CheckoutPageClient } from '@/components/checkout/CheckoutPageClient'
import { getLojaFromHeaders } from '@/lib/tenant'

export default async function CheckoutPage() {
  const loja = await getLojaFromHeaders()
  if (!loja) notFound()

  return (
    <CheckoutPageClient
      loja={{
        id: loja.id,
        name: loja.name,
        pixKey: loja.pixKey ?? '',
        whatsappNumber: loja.whatsappNumber ?? '',
      }}
    />
  )
}
