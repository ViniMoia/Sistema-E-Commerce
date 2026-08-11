import prisma from "@/lib/prisma";
import { UserOrder } from "@/app/profile/types";

export async function getUserOrders(userId: string, limit = 10, skip = 0): Promise<UserOrder[]> {
  try {
    const orders = await prisma.order.findMany({
      where: {
        userID: userId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        trackingCode: true,
        items: {
          select: {
            name: true,
            price: true,
            quantity: true,
            color: true,
            size: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: skip,
    });
    
    return orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      trackingCode: order.trackingCode,
      items: order.items.map(item => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        color: item.color,
        size: item.size,
      }))
    }));
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return [];
  }
}
