import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createOrder, type CreateOrderParams } from '@/services/checkout.service';
import { drainPaymentInbox, reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';
import { drainPaymentOutbox } from '@/services/payment/payment-outbox.service';
import type { PaymentGateway, PaymentInspection, PixChargeResult } from '@/types/payment-gateway.types';

export type ProcessTask = {
  action: 'checkout' | 'inbox' | 'reconcile' | 'outbox';
  input?: CreateOrderParams;
  pause?: 'order-before-commit' | 'before-create' | 'after-create' | 'after-inspect' | 'before-commit' | 'after-commit' | 'after-send'
    | 'before-operation' | 'after-operation' | 'operation-before-commit';
};
type Message = { type: string; id?: number; value?: unknown; task?: ProcessTask };
const replies = new Map<number, (value: unknown) => void>();
let sequence = 0;
let resume: (() => void) | undefined;
let configure: (task: ProcessTask) => void;
const configured = new Promise<ProcessTask>(resolve => { configure = resolve; });
process.on('message', (raw: Message) => {
  if (raw.type === 'task' && raw.task) configure(raw.task);
  if (raw.type === 'reply' && raw.id) { replies.get(raw.id)?.(raw.value); replies.delete(raw.id); }
  if (raw.type === 'resume') { resume?.(); resume = undefined; }
});
function rpc<T>(operation: string, value: unknown): Promise<T> {
  const id = ++sequence;
  return new Promise(resolve => {
    replies.set(id, result => resolve(result as T));
    process.send!({ type: 'rpc', id, operation, value });
  });
}

export async function run() {
  await verifyTestDatabase(); // Fresh Prisma client, same protected sentinel as the parent.
  process.send!({ type: 'ready', pid: process.pid });
  const task = await configured;
  let paused = false;
  async function checkpoint(name: ProcessTask['pause']) {
    if (paused || task.pause !== name) return;
    paused = true;
    await new Promise<void>(resolve => {
      resume = resolve;
      process.send!({ type: 'checkpoint', name });
    });
  }
  prisma.$use(async (params, next) => {
    const result = await next(params);
    if (params.runInTransaction && params.model === 'CommerceOutbox' && params.action === 'create'
      && params.args?.data?.commandType === 'CHECKOUT_COMMITTED') await checkpoint('order-before-commit');
    if (params.runInTransaction && params.model === 'CommerceOutbox' && params.action === 'updateMany'
      && params.args?.where?.commandType === 'PAYMENT_REVIEW'
      && params.args?.data?.status === 'COMPLETED') await checkpoint('operation-before-commit');
    // Pause after financial/commercial writes, still inside the real transaction.
    if (params.runInTransaction && params.model === 'CommerceOutbox' && params.action === 'upsert'
      && String(params.args?.where?.effectKey ?? '').startsWith('payment-confirmation:')) {
      await checkpoint('before-commit');
    }
    return result;
  });
  const unsupported = async (): Promise<never> => { throw new Error('UNEXPECTED_GATEWAY_OPERATION'); };
  const gateway: PaymentGateway = {
    capabilities: async () => ({ configured: true, methods: ['PIX'], maximumInstallments: 1 }),
    createPixCharge: async input => {
      await checkpoint('before-create');
      const result = await rpc<PixChargeResult>('create', { orderId: input.orderId, value: input.value });
      await checkpoint('after-create');
      return result;
    },
    inspectAttempt: async input => {
      const inspection = await rpc<PaymentInspection>('inspect', input);
      await checkpoint('after-inspect');
      return inspection;
    },
    cancelPayment: async paymentId => {
      await checkpoint('before-operation');
      await rpc('cancel', { paymentId });
      await checkpoint('after-operation');
    },
    refundPayment: async (paymentId, amount) => {
      await checkpoint('before-operation');
      await rpc('refund', { paymentId, amount });
      await checkpoint('after-operation');
    },
    createBoletoCharge: unsupported, createCreditCardCharge: unsupported, getPaymentStatus: unsupported,
  };
  const result = task.action === 'checkout' ? await createOrder({ ...task.input!, paymentGateway: gateway })
    : task.action === 'inbox' ? await drainPaymentInbox(50, gateway)
    : task.action === 'reconcile' ? await reconcilePaymentAttempts(50, gateway)
    : await drainPaymentOutbox(50, async options => {
      const sent = await rpc<{ success: boolean; messageId: string }>('send', options);
      await checkpoint('after-send');
      return sent;
    });
  await checkpoint('after-commit');
  process.send!({ type: 'done', result });
}
export const disconnect = () => prisma.$disconnect();
