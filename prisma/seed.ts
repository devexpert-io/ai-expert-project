import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categoryFixture = [
  {
    slug: "camisetas",
    name: "Camisetas",
    description: "Prendas ligeras para todos los días.",
  },
  {
    slug: "pantalones",
    name: "Pantalones",
    description: "Cortes cómodos para combinar a diario.",
  },
  {
    slug: "abrigos",
    name: "Abrigos",
    description: "Capas exteriores para los días frescos.",
  },
  {
    slug: "sudaderas",
    name: "Sudaderas",
    description: "Felpas suaves para un estilo relajado.",
  },
] as const;

const productFixture = [
  {
    slug: "camiseta-basica",
    name: "Camiseta básica",
    description: "Camiseta de algodón de corte regular y tacto suave.",
    imageUrl: "https://placehold.co/800x1000/png?text=camiseta-basica",
    basePriceCents: 1990,
    categorySlug: "camisetas",
    variants: [
      { sku: "CAM-BAS-S-NEGRO", size: "S", color: "Negro", stock: 12, priceCents: 1990 },
      { sku: "CAM-BAS-M-NEGRO", size: "M", color: "Negro", stock: 0, priceCents: 1990 },
      { sku: "CAM-BAS-L-BLANCO", size: "L", color: "Blanco", stock: 8, priceCents: 1990 },
      { sku: "CAM-BAS-XL-AZUL", size: "XL", color: "Azul", stock: 5, priceCents: 2090 },
    ],
  },
  {
    slug: "camiseta-rayas",
    name: "Camiseta de rayas",
    description: "Camiseta de punto ligero con rayas marineras.",
    imageUrl: "https://placehold.co/800x1000/png?text=camiseta-rayas",
    basePriceCents: 2490,
    categorySlug: "camisetas",
    variants: [
      { sku: "CAM-RAY-S-MARINO", size: "S", color: "Marino", stock: 7, priceCents: 2490 },
      { sku: "CAM-RAY-M-MARINO", size: "M", color: "Marino", stock: 9, priceCents: 2490 },
      { sku: "CAM-RAY-L-ROJO", size: "L", color: "Rojo", stock: 4, priceCents: 2590 },
      { sku: "CAM-RAY-XL-VERDE", size: "XL", color: "Verde", stock: 3, priceCents: 2590 },
    ],
  },
  {
    slug: "pantalon-recto",
    name: "Pantalón recto",
    description: "Pantalón de sarga con pernera recta y cinco bolsillos.",
    imageUrl: "https://placehold.co/800x1000/png?text=pantalon-recto",
    basePriceCents: 4990,
    categorySlug: "pantalones",
    variants: [
      { sku: "PAN-REC-S-BEIGE", size: "S", color: "Beige", stock: 6, priceCents: 4990 },
      { sku: "PAN-REC-M-BEIGE", size: "M", color: "Beige", stock: 10, priceCents: 4990 },
      { sku: "PAN-REC-L-NEGRO", size: "L", color: "Negro", stock: 5, priceCents: 5090 },
      { sku: "PAN-REC-XL-NEGRO", size: "XL", color: "Negro", stock: 2, priceCents: 5090 },
    ],
  },
  {
    slug: "pantalon-cargo",
    name: "Pantalón cargo",
    description: "Pantalón cargo resistente con bolsillos laterales amplios.",
    imageUrl: "https://placehold.co/800x1000/png?text=pantalon-cargo",
    basePriceCents: 5990,
    categorySlug: "pantalones",
    variants: [
      { sku: "PAN-CAR-S-KAKI", size: "S", color: "Kaki", stock: 4, priceCents: 5990 },
      { sku: "PAN-CAR-M-KAKI", size: "M", color: "Kaki", stock: 7, priceCents: 5990 },
      { sku: "PAN-CAR-L-GRIS", size: "L", color: "Gris", stock: 5, priceCents: 6090 },
      { sku: "PAN-CAR-XL-GRIS", size: "XL", color: "Gris", stock: 1, priceCents: 6090 },
    ],
  },
  {
    slug: "abrigo-ligero",
    name: "Abrigo ligero",
    description: "Abrigo impermeable y ligero para entretiempo.",
    imageUrl: "https://placehold.co/800x1000/png?text=abrigo-ligero",
    basePriceCents: 8990,
    categorySlug: "abrigos",
    variants: [
      { sku: "ABR-LIG-S-ARENA", size: "S", color: "Arena", stock: 3, priceCents: 8990 },
      { sku: "ABR-LIG-M-ARENA", size: "M", color: "Arena", stock: 6, priceCents: 8990 },
      { sku: "ABR-LIG-L-VERDE", size: "L", color: "Verde", stock: 4, priceCents: 9090 },
      { sku: "ABR-LIG-XL-MARINO", size: "XL", color: "Marino", stock: 2, priceCents: 9090 },
    ],
  },
  {
    slug: "sudadera-con-capucha",
    name: "Sudadera con capucha",
    description: "Sudadera de felpa con capucha y bolsillo delantero.",
    imageUrl: "https://placehold.co/800x1000/png?text=sudadera-con-capucha",
    basePriceCents: 5490,
    categorySlug: "sudaderas",
    variants: [
      { sku: "SUD-CAP-S-GRIS", size: "S", color: "Gris", stock: 8, priceCents: 5490 },
      { sku: "SUD-CAP-M-GRIS", size: "M", color: "Gris", stock: 11, priceCents: 5490 },
      { sku: "SUD-CAP-L-NEGRO", size: "L", color: "Negro", stock: 5, priceCents: 5590 },
      { sku: "SUD-CAP-XL-ROJO", size: "XL", color: "Rojo", stock: 3, priceCents: 5590 },
    ],
  },
] as const;

async function seed() {
  await prisma.$transaction(async (transaction) => {
    const categories = new Map<string, { id: string }>();

    for (const category of categoryFixture) {
      const savedCategory = await transaction.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: {
          name: category.name,
          description: category.description,
        },
        select: { id: true },
      });

      categories.set(category.slug, savedCategory);
    }

    for (const productData of productFixture) {
      const category = categories.get(productData.categorySlug);
      if (!category) {
        throw new Error(`Missing category for product ${productData.slug}`);
      }

      const product = await transaction.product.upsert({
        where: { slug: productData.slug },
        create: {
          slug: productData.slug,
          name: productData.name,
          description: productData.description,
          imageUrl: productData.imageUrl,
          basePriceCents: productData.basePriceCents,
          category: { connect: { id: category.id } },
        },
        update: {
          name: productData.name,
          description: productData.description,
          imageUrl: productData.imageUrl,
          basePriceCents: productData.basePriceCents,
          category: { connect: { id: category.id } },
        },
        select: { id: true },
      });

      for (const variant of productData.variants) {
        await transaction.variant.upsert({
          where: { sku: variant.sku },
          create: {
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            priceCents: variant.priceCents,
            product: { connect: { id: product.id } },
          },
          update: {
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            priceCents: variant.priceCents,
            product: { connect: { id: product.id } },
          },
        });
      }
    }
  });

  const variantCount = productFixture.reduce(
    (count, product) => count + product.variants.length,
    0,
  );
  console.log(
    `Seed OK: ${categoryFixture.length} categories, ${productFixture.length} products, ${variantCount} variants.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
