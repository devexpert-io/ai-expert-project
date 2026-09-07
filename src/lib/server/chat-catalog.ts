import "server-only";
import { prisma } from "./prisma";

export async function getChatCatalog() {
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      name: true, description: true, basePriceCents: true,
      category: { select: { name: true } },
      variants: {
        orderBy: [{ size: "asc" }, { color: "asc" }],
        select: { size: true, color: true, priceCents: true, stock: true },
      },
    },
  });
  return { currency: "EUR", priceUnit: "céntimos", products };
}
