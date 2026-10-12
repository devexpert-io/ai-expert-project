import "server-only";

import type { Prisma } from "@prisma/client";

import {
  isSupportedOrderStatus,
  type OrderStatus,
} from "./orders";
import { prisma } from "./prisma";

type OrderDetailLineRecord = Readonly<{
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPriceCents: number;
}>;

type OrderDetailRecord = Readonly<{
  status: string;
  totalCents: number;
  createdAt: Date;
  lines: readonly OrderDetailLineRecord[];
}>;

export type UserOrderDetailLine = Readonly<
  OrderDetailLineRecord & { lineTotalCents: number }
>;

export type UserOrderDetail = Readonly<{
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  lines: readonly UserOrderDetailLine[];
}>;

const orderDetailSelect = {
  status: true,
  totalCents: true,
  createdAt: true,
  lines: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      productName: true,
      size: true,
      color: true,
      quantity: true,
      unitPriceCents: true,
    },
  },
} satisfies Prisma.OrderSelect;

function addSafeIntegers(left: number, right: number): number | null {
  const result = left + right;
  return Number.isSafeInteger(result) ? result : null;
}

function hasSnapshotText(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function buildOrderDetail(
  order: OrderDetailRecord,
): UserOrderDetail | null {
  if (
    typeof order.status !== "string" ||
    !isSupportedOrderStatus(order.status) ||
    !Number.isSafeInteger(order.totalCents) ||
    order.totalCents <= 0 ||
    !(order.createdAt instanceof Date) ||
    !Number.isFinite(order.createdAt.getTime()) ||
    !Array.isArray(order.lines) ||
    order.lines.length === 0
  ) {
    return null;
  }

  let subtotalCents = 0;
  const lines: UserOrderDetailLine[] = [];

  for (const line of order.lines) {
    if (
      !line ||
      !hasSnapshotText(line.productName) ||
      !hasSnapshotText(line.size) ||
      !hasSnapshotText(line.color) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isSafeInteger(line.unitPriceCents) ||
      line.unitPriceCents <= 0
    ) {
      return null;
    }

    const lineTotalCents = line.quantity * line.unitPriceCents;
    if (!Number.isSafeInteger(lineTotalCents)) {
      return null;
    }

    const nextSubtotalCents = addSafeIntegers(subtotalCents, lineTotalCents);
    if (nextSubtotalCents === null) {
      return null;
    }

    subtotalCents = nextSubtotalCents;
    lines.push({ ...line, lineTotalCents });
  }

  if (subtotalCents !== order.totalCents) {
    return null;
  }

  return {
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    lines,
  };
}

export async function getUserOrderDetail(
  userId: string,
  orderId: string,
): Promise<UserOrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: orderDetailSelect,
  });

  return order ? buildOrderDetail(order as OrderDetailRecord) : null;
}

