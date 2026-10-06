import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getLojaFromHeaders } from '@/lib/tenant';
import { checkRateLimit } from '@/lib/rate-limit';
import { buyerSelect, orderCustomer, snapshotDeliveryAddress, validGuestOrderAccess } from '@/lib/commerce/order-buyer';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = checkRateLimit(request, 'guest_order_recovery', 30, 60000);
  if (limited) return limited;
  const missing = () => NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const tenant = await getLojaFromHeaders();
  if (!tenant) return missing();
  const token = request.headers.get('x-order-access-token');
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return missing();
  const { id } = await context.params;
  const order = await prisma.order.findFirst({ where: { id, lojaID: tenant.id, userID: null }, select: {
    id: true, orderNumber: true, status: true, deliveryType: true, total: true, subtotal: true,
    shippingCost: true, shippingServiceName: true, shippingEstimatedDays: true, asaasPaymentStatus: true,
    buyer: { select: { ...buyerSelect, recoveryTokenHash: true, recoveryExpiresAt: true } },
    items: { select: { name: true, quantity: true, price: true, color: true, size: true } },
  } });
  if (!order || !validGuestOrderAccess(token, order.buyer)) return missing();
  // Never serialize auth subjects, recovery hashes, or internal gateway references.
  return NextResponse.json({ id: order.id, orderNumber: order.orderNumber, status: order.status,
    deliveryType: order.deliveryType, total: Number(order.total), subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost), shippingServiceName: order.shippingServiceName,
    shippingEstimatedDays: order.shippingEstimatedDays, asaasPaymentStatus: order.asaasPaymentStatus,
    customer: { name: orderCustomer(order).name, email: orderCustomer(order).email, phone: orderCustomer(order).phone },
    address: snapshotDeliveryAddress(order.buyer), items: order.items.map(item => ({ ...item, price: Number(item.price) })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
