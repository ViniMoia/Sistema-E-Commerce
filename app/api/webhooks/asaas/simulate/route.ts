import { logger } from '@/lib/logger'
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { updateOrderStatus } from "@/services/order.service";

const simulationSchema = z.object({
  orderId: z.string().min(1).max(100),
  // Estorno nao pode ser simulado como conclusao: use adapter fake ou sandbox
  // e a consulta autoritativa de refunds.
  event: z.enum(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]).default("PAYMENT_RECEIVED"),
}).strict();

/** Endpoint opt-in para homologação local sem contato com o gateway real. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_WEBHOOK_SIMULATOR !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const parsed = simulationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload de simulação inválido." }, { status: 400 });
  }

  let claimedEventId: string | null = null;

  try {
    const { orderId, event } = parsed.data;
    const order = await prisma.order.findFirst({
      where: { id: orderId, lojaID: guard.user.lojaID },
      select: { id: true, status: true, lojaID: true, total: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const simEventId = `sim_${event}_${order.id}_${Date.now()}`;
    const simPaymentId = `pay_sim_${Date.now()}`;

    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "ASAAS_SIMULATOR",
        eventId: simEventId,
        eventType: event,
        status: "PROCESSING",
        attempts: 1,
        lockedAt: new Date(),
        payload: {
          simulated: true,
          event,
          payment: {
            id: simPaymentId,
            externalReference: order.id,
            status: "RECEIVED",
            value: Number(order.total),
          },
        },
      },
    });
    claimedEventId = simEventId;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        asaasPaymentId: simPaymentId,
        asaasPaymentStatus: "RECEIVED",
      },
    });

    const statusResult = await updateOrderStatus({
      orderId: order.id,
      newStatus: "PAID",
      performedById: guard.user.id,
      lojaID: guard.user.lojaID,
    });
    if (statusResult.success === false) {
      await prisma.paymentWebhookEvent.update({
        where: { eventId: simEventId },
        data: { status: "FAILED", lockedAt: null, lastError: statusResult.error },
      });
      claimedEventId = null;
      return NextResponse.json(
        { error: statusResult.error },
        { status: statusResult.code === "CONFLICT" ? 409 : 422 }
      );
    }

    await prisma.paymentWebhookEvent.update({
      where: { eventId: simEventId },
      data: { status: "PROCESSED", processedAt: new Date(), lockedAt: null, lastError: null },
    });
    claimedEventId = null;

    return NextResponse.json({
      success: true,
      simulated: true,
      eventId: simEventId,
      orderId: order.id,
      newStatus: "PAID",
    });
  } catch (error) {
    if (claimedEventId) {
      await prisma.paymentWebhookEvent.update({
        where: { eventId: claimedEventId },
        data: {
          status: "FAILED",
          lockedAt: null,
          lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        },
      }).catch(() => undefined);
    }
    logger.error("[ASAAS_SIMULATOR_ERROR]", error);
    return NextResponse.json({ error: "Erro ao simular webhook do Asaas" }, { status: 500 });
  }
}
