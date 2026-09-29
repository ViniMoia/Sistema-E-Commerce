import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'
import { validateTestEnvironment } from '@/tests/setup/db'
import { POST as asaasWebhook } from '@/app/api/webhooks/asaas/route'
import { runPaymentReconciliation } from '@/services/payment-reconciliation.service'
import { requestOrderRefund, runRefundReconciliation } from '@/services/refund.service'
import { asaasPaymentAdapter } from '@/services/asaas/asaas.adapter'
import type { PaymentGateway, PaymentStatusResult } from '@/types/payment-gateway.types'

const runId = `payment-recon-${Date.now()}-${Math.random().toString(16).slice(2)}`
const lojaID = `${runId}-store`
const userID = `${runId}-user`
const productID = `${runId}-product`
const webhookToken = `${runId}-webhook-token`
let setupComplete = false

function gateway(
  result: PaymentStatusResult[] | Error,
  delay?: Promise<void>,
  refunds: Array<{ status: string; value: number; description?: string }> = []
): PaymentGateway {
  return {
    createPixCharge: vi.fn(),
    createCreditCardCharge: vi.fn(),
    createBoletoCharge: vi.fn(),
    getPaymentStatus: vi.fn(),
    requestRefund: vi.fn(),
    listPaymentRefunds: vi.fn().mockResolvedValue(refunds),
    findPaymentsByReference: vi.fn(async () => {
      await delay
      if (result instanceof Error) throw result
      return result
    }),
  }
}

async function createFixture(params: {
  suffix: string
  orderStatus?: 'PENDING' | 'PAID' | 'CANCELLED'
  pointsEarned?: number
}) {
  const orderID = `${runId}-order-${params.suffix}`
  const paymentReference = `${runId}-reference-${params.suffix}`
  return prisma.order.create({
    data: {
      id: orderID,
      userID,
      lojaID,
      status: params.orderStatus ?? 'PENDING',
      deliveryType: 'PICKUP',
      subtotal: new Prisma.Decimal('100.00'),
      shippingCost: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('100.00'),
      paymentMethod: 'PIX',
      paymentReference,
      paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
      paymentAttemptedAt: new Date(Date.now() - 60_000),
      pointsEarned: params.pointsEarned ?? 0,
      items: {
        create: {
          productId: productID,
          name: 'Produto reservado para reconciliação',
          quantity: 1,
          price: new Prisma.Decimal('100.00'),
        },
      },
      paymentReconciliation: {
        create: {
          paymentReference,
          status: 'PENDING',
          nextAttemptAt: new Date(Date.now() - 1_000),
        },
      },
    },
  })
}

describe.sequential('payment reconciliation with local PostgreSQL', () => {
  beforeAll(async () => {
    validateTestEnvironment()
    await prisma.$connect()
    process.env.ASAAS_WEBHOOK_TOKEN = webhookToken
    await prisma.loja.create({
      data: {
        id: lojaID, name: 'Payment reconciliation fixture', slug: lojaID,
        description: 'Scoped disposable fixture', coverImageUrl: '/fixture.jpg',
        loyaltyEnabled: true,
      },
    })
    await prisma.user.create({
      data: {
        id: userID, name: 'Fixture User', email: `${userID}@test.local`,
        password: 'fixture-only', lojaID,
      },
    })
    await prisma.product.create({
      data: {
        id: productID, name: 'Fixture Product', description: 'Scoped disposable fixture',
        price: new Prisma.Decimal('100.00'), imageUrl: '/fixture.jpg', stock: 9,
        lojaID, userID,
      },
    })
    setupComplete = true
  })

  afterAll(async () => {
    if (!setupComplete) return
    await prisma.paymentWebhookEvent.deleteMany({ where: { eventId: { startsWith: runId } } })
    await prisma.orderStatusHistory.deleteMany({ where: { order: { lojaID } } })
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: userID }, { targetId: userID }, { entityId: { startsWith: runId } }] },
    })
    await prisma.loyaltyTransaction.deleteMany({ where: { lojaID } })
    await prisma.loyaltyWallet.deleteMany({ where: { lojaID } })
    await prisma.order.deleteMany({ where: { lojaID } })
    await prisma.product.deleteMany({ where: { lojaID } })
    await prisma.user.deleteMany({ where: { lojaID } })
    await prisma.loja.deleteMany({ where: { id: lojaID } })
    await prisma.$disconnect()
  })

  it('arbitrates two workers and commits paid/points effects exactly once', async () => {
    const order = await createFixture({ suffix: 'two-workers', pointsEarned: 10 })
    const fake = gateway([{
      paymentId: `${runId}-pay-two-workers`, status: 'CONFIRMED',
      externalReference: order.paymentReference, billingType: 'PIX', value: 100,
    }])

    const [one, two] = await Promise.all([
      runPaymentReconciliation({ paymentGateway: fake, workerId: `${runId}-worker-a` }),
      runPaymentReconciliation({ paymentGateway: fake, workerId: `${runId}-worker-b` }),
    ])

    expect(one.claimed + two.claimed).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID')
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id, status: 'PAID' } })).toBe(1)
    expect(await prisma.loyaltyTransaction.count({
      where: { operationKey: `order:${order.id}:EARN` },
    })).toBe(1)
    expect((await prisma.loyaltyWallet.findUniqueOrThrow({
      where: { lojaID_userID: { lojaID, userID } },
    })).balance).toBe(10)
  })

  it('recovers after process failure between effects and reconciliation commit', async () => {
    const order = await createFixture({ suffix: 'restart' })
    const fake = gateway([{
      paymentId: `${runId}-pay-restart`, status: 'CONFIRMED',
      externalReference: order.paymentReference, billingType: 'PIX', value: 100,
    }])

    await runPaymentReconciliation({
      paymentGateway: fake,
      baseBackoffMs: 1,
      afterEffectsCommitted: async (id) => {
        if (id === order.id) throw new Error('simulated process termination')
      },
    })
    const retryAt = (await prisma.paymentReconciliation.findUniqueOrThrow({
      where: { orderID: order.id },
    })).nextAttemptAt
    await runPaymentReconciliation({ paymentGateway: fake, now: new Date(retryAt.getTime() + 1) })

    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id, status: 'PAID' } })).toBe(1)
    expect(await prisma.paymentReconciliation.findUniqueOrThrow({ where: { orderID: order.id } }))
      .toMatchObject({ status: 'RESOLVED', attempts: 2 })
  })

  it('converges with a simultaneous webhook without duplicating effects', async () => {
    const order = await createFixture({ suffix: 'webhook-race', pointsEarned: 7 })
    let releaseLookup!: () => void
    const lookupGate = new Promise<void>((resolve) => { releaseLookup = resolve })
    const fake = gateway([{
      paymentId: `${runId}-pay-webhook-race`, status: 'CONFIRMED',
      externalReference: order.paymentReference, billingType: 'PIX', value: 100,
    }], lookupGate)

    const worker = runPaymentReconciliation({ paymentGateway: fake, workerId: `${runId}-worker-race` })
    while (!vi.mocked(fake.findPaymentsByReference).mock.calls.length) {
      await new Promise((resolve) => setTimeout(resolve, 1))
    }
    const webhook = asaasWebhook(new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'asaas-access-token': webhookToken },
      body: JSON.stringify({
        id: `${runId}-event-race`, event: 'PAYMENT_CONFIRMED',
        payment: {
          id: `${runId}-pay-webhook-race`, externalReference: order.paymentReference,
          status: 'CONFIRMED', value: 100, billingType: 'PIX',
        },
      }),
    }))
    await webhook
    releaseLookup()
    await worker

    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id, status: 'PAID' } })).toBe(1)
    expect(await prisma.loyaltyTransaction.count({
      where: { operationKey: `order:${order.id}:EARN` },
    })).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID')
  })

  it('keeps an out-of-order confirmation after cancellation in manual review', async () => {
    const order = await createFixture({ suffix: 'out-of-order', orderStatus: 'CANCELLED' })
    const fake = gateway([{
      paymentId: `${runId}-pay-out-of-order`, status: 'CONFIRMED',
      externalReference: order.paymentReference, billingType: 'PIX', value: 100,
    }])

    await runPaymentReconciliation({ paymentGateway: fake })

    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ status: 'CANCELLED', paymentWorkflowStatus: 'RECONCILIATION_REQUIRED' })
    expect(await prisma.paymentReconciliation.findUniqueOrThrow({ where: { orderID: order.id } }))
      .toMatchObject({ status: 'MANUAL_REVIEW', lastErrorCode: 'PAYMENT_CONFIRMED_AFTER_CANCELLATION' })
  })

  it('restores reserved inventory once when two workers observe a refund', async () => {
    const order = await createFixture({ suffix: 'refund', orderStatus: 'PAID' })
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock
    const operationReference = `refund:${runId}-intent-refund`
    await prisma.refundIntent.create({
      data: {
        id: `${runId}-intent-refund`, orderID: order.id, lojaID,
        operationKey: `${runId}-refund-operation`, operationReference,
        gatewayPaymentId: `${runId}-pay-refund`, kind: 'FULL', amount: new Prisma.Decimal('100.00'),
        status: 'PROCESSING', gatewayCalledAt: new Date(), requestedById: userID,
        reason: 'Fixture de estorno integral', nextAttemptAt: new Date(Date.now() - 1000),
      },
    })
    const fake = gateway([{
      paymentId: `${runId}-pay-refund`, status: 'REFUNDED',
      externalReference: order.paymentReference, billingType: 'PIX', value: 100,
    }], undefined, [{ status: 'DONE', value: 100, description: operationReference }])

    await Promise.all([
      runPaymentReconciliation({ paymentGateway: fake, workerId: `${runId}-refund-a` }),
      runPaymentReconciliation({ paymentGateway: fake, workerId: `${runId}-refund-b` }),
    ])

    expect((await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock)
      .toBe(stockBefore + 1)
    expect(await prisma.orderStatusHistory.count({
      where: { orderId: order.id, status: 'CANCELLED' },
    })).toBe(1)
    expect(await prisma.paymentReconciliation.findUniqueOrThrow({ where: { orderID: order.id } }))
      .toMatchObject({ status: 'RESOLVED', gatewayStatus: 'REFUNDED' })
  })

  it('confirms two partial refunds cumulatively and applies full effects once', async () => {
    const order = await createFixture({ suffix: 'two-partials', orderStatus: 'PAID' })
    const paymentId = `${runId}-pay-two-partials`
    await prisma.order.update({ where: { id: order.id }, data: { asaasPaymentId: paymentId } })
    const refs = [`refund:${runId}-partial-a`, `refund:${runId}-partial-b`]
    await prisma.refundIntent.createMany({
      data: [
        {
          id: `${runId}-partial-a`, orderID: order.id, lojaID,
          operationKey: `${runId}-partial-operation-a`, operationReference: refs[0],
          gatewayPaymentId: paymentId, kind: 'PARTIAL', amount: new Prisma.Decimal('40.00'),
          status: 'PROCESSING', gatewayCalledAt: new Date(), requestedById: userID,
          reason: 'Fixture parcial A', nextAttemptAt: new Date(Date.now() - 1000),
        },
        {
          id: `${runId}-partial-b`, orderID: order.id, lojaID,
          operationKey: `${runId}-partial-operation-b`, operationReference: refs[1],
          gatewayPaymentId: paymentId, kind: 'PARTIAL', amount: new Prisma.Decimal('60.00'),
          status: 'PROCESSING', gatewayCalledAt: new Date(), requestedById: userID,
          reason: 'Fixture parcial B', nextAttemptAt: new Date(Date.now() - 1000),
        },
      ],
    })
    const fake = gateway([], undefined, [
      { status: 'DONE', value: 40, description: refs[0] },
      { status: 'DONE', value: 60, description: refs[1] },
    ])
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock

    const [one, two] = await Promise.all([
      runRefundReconciliation({ paymentGateway: fake, workerId: `${runId}-partial-worker-a` }),
      runRefundReconciliation({ paymentGateway: fake, workerId: `${runId}-partial-worker-b` }),
    ])

    expect(one.claimed + two.claimed).toBe(2)
    expect(await prisma.refundIntent.count({
      where: { orderID: order.id, status: 'CONFIRMED', effectAppliedAt: { not: null } },
    })).toBe(2)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })))
      .toMatchObject({ status: 'CANCELLED', paymentWorkflowStatus: 'REFUNDED' })
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id, status: 'CANCELLED' } })).toBe(1)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock)
      .toBe(stockBefore + 1)
  })

  it('serializes concurrent refund commands and never reserves above the order total', async () => {
    const order = await createFixture({ suffix: 'concurrent-refund-commands', orderStatus: 'PAID' })
    const paymentId = `${runId}-pay-concurrent-refunds`
    await prisma.order.update({
      where: { id: order.id },
      data: {
        asaasPaymentId: paymentId,
        asaasPaymentStatus: 'RECEIVED',
        paymentWorkflowStatus: 'CONFIRMED',
      },
    })
    const fake = gateway([])
    vi.mocked(fake.requestRefund).mockResolvedValue({ paymentId, status: 'REFUND_IN_PROGRESS' })

    const results = await Promise.allSettled([
      requestOrderRefund({
        orderId: order.id, lojaID, requestedById: userID,
        operationKey: `${runId}-concurrent-a`, amount: 60, reason: 'Parcial concorrente A',
      }, { paymentGateway: fake }),
      requestOrderRefund({
        orderId: order.id, lojaID, requestedById: userID,
        operationKey: `${runId}-concurrent-b`, amount: 60, reason: 'Parcial concorrente B',
      }, { paymentGateway: fake }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await prisma.refundIntent.count({ where: { orderID: order.id } })).toBe(1)
    const reserved = await prisma.refundIntent.aggregate({
      where: { orderID: order.id }, _sum: { amount: true },
    })
    expect(Number(reserved._sum.amount)).toBe(60)
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
  })

  it('deduplicates two concurrent deliveries of the same refund command', async () => {
    const order = await createFixture({ suffix: 'same-refund-command', orderStatus: 'PAID' })
    const paymentId = `${runId}-pay-same-refund-command`
    await prisma.order.update({
      where: { id: order.id },
      data: {
        asaasPaymentId: paymentId,
        asaasPaymentStatus: 'RECEIVED',
        paymentWorkflowStatus: 'CONFIRMED',
      },
    })
    const fake = gateway([])
    vi.mocked(fake.requestRefund).mockResolvedValue({ paymentId, status: 'REFUND_IN_PROGRESS' })
    const input = {
      orderId: order.id, lojaID, requestedById: userID,
      operationKey: `${runId}-same-operation`, amount: 40, reason: 'Entrega duplicada',
    }

    const [first, second] = await Promise.all([
      requestOrderRefund(input, { paymentGateway: fake }),
      requestOrderRefund(input, { paymentGateway: fake }),
    ])

    expect(first.id).toBe(second.id)
    expect(await prisma.refundIntent.count({ where: { orderID: order.id } })).toBe(1)
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
  })

  it('enforces the order tenant on refund intents at the database boundary', async () => {
    const order = await createFixture({ suffix: 'refund-tenant-fk', orderStatus: 'PAID' })

    await expect(prisma.refundIntent.create({
      data: {
        id: `${runId}-wrong-tenant-intent`, orderID: order.id, lojaID: `${lojaID}-other`,
        operationKey: `${runId}-wrong-tenant-operation`,
        operationReference: `refund:${runId}-wrong-tenant-intent`,
        gatewayPaymentId: `${runId}-wrong-tenant-payment`, kind: 'PARTIAL',
        amount: new Prisma.Decimal('1.00'), requestedById: userID,
        reason: 'Tentativa cross-tenant',
      },
    })).rejects.toMatchObject({ code: 'P2003' })
  })

  it('converges when refund webhook and worker run simultaneously', async () => {
    const order = await createFixture({ suffix: 'refund-webhook-race', orderStatus: 'PAID' })
    const paymentId = `${runId}-pay-refund-webhook-race`
    const operationReference = `refund:${runId}-webhook-race`
    await prisma.order.update({ where: { id: order.id }, data: { asaasPaymentId: paymentId } })
    await prisma.refundIntent.create({
      data: {
        id: `${runId}-webhook-race`, orderID: order.id, lojaID,
        operationKey: `${runId}-webhook-race-operation`, operationReference,
        gatewayPaymentId: paymentId, kind: 'FULL', amount: new Prisma.Decimal('100.00'),
        status: 'PROCESSING', gatewayCalledAt: new Date(), requestedById: userID,
        reason: 'Fixture webhook concorrente', nextAttemptAt: new Date(Date.now() - 1000),
      },
    })
    const refunds = [{ status: 'DONE', value: 100, description: operationReference }]
    const fake = gateway([], undefined, refunds)
    const adapterSpy = vi.spyOn(asaasPaymentAdapter, 'listPaymentRefunds').mockResolvedValue(refunds)

    const [response] = await Promise.all([
      asaasWebhook(new Request('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'asaas-access-token': webhookToken },
        body: JSON.stringify({
          id: `${runId}-refund-event-race`, event: 'PAYMENT_REFUNDED',
          payment: {
            id: paymentId, externalReference: order.paymentReference,
            status: 'REFUNDED', value: 100, billingType: 'PIX',
          },
        }),
      })),
      runRefundReconciliation({ paymentGateway: fake, workerId: `${runId}-refund-worker-race` }),
    ])
    adapterSpy.mockRestore()

    expect(response.status).toBe(200)
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id, status: 'CANCELLED' } })).toBe(1)
    expect(await prisma.refundIntent.findUniqueOrThrow({ where: { operationReference } }))
      .toMatchObject({ status: 'CONFIRMED' })
  })
})
