import { getPaymentConfig } from '@/lib/config/payment.config';
import type { Loja } from '@prisma/client';
import type { PaymentGateway, PaymentMethod } from '@/types/payment-gateway.types';
export async function paymentCapabilities(store: Loja, gateway: PaymentGateway) {
  const config = getPaymentConfig(); const remote = await gateway.capabilities(store.id);
  const methods: PaymentMethod[] = [];
  if (store.enableManualPix && store.pixKey?.trim() && /^\d{10,13}$/.test((store.whatsappNumber ?? '').replace(/\D/g, ''))) methods.push('WHATSAPP_PIX');
  if (remote.configured) {
    for (const method of remote.methods) {
      if ((method === 'PIX' && store.enablePix) || (method === 'BOLETO' && store.enableBoleto) || (method === 'CREDIT_CARD' && store.enableCreditCard)) methods.push(method);
    }
  }
  return { schemaVersion: 1, lojaID: store.id, configurationVersion: store.configurationVersion, methods,
    maximumInstallments: Math.min(config.installmentMaxCount, remote.maximumInstallments), config };
}
