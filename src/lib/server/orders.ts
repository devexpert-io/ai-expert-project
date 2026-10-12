import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const ORDER_STATUS_LABELS = {
  PAID: "Pagado",
  CANCELLED: "Cancelado",
  PENDING_PAYMENT: "Pendiente de pago",
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;

export type UserOrder = Readonly<{
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
}>;

const orderSelect = {
  id: true,
  status: true,
  totalCents: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

export function isSupportedOrderStatus(status: string): status is OrderStatus {
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABELS, status);
}

export async function getUserOrders(userId: string): Promise<UserOrder[]> {
  return prisma.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: orderSelect,
  });
}
