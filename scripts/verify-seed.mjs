import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const requiredTables = [
  "User",
  "Product",
  "Variant",
  "Category",
  "Cart",
  "CartItem",
  "Order",
  "OrderLine",
  "Chat",
  "TryonImage",
];
const requiredCategorySlugs = [
  "camisetas",
  "pantalones",
  "abrigos",
  "sudaderas",
];
const requiredProductSlugs = [
  "camiseta-basica",
  "pantalon-recto",
  "abrigo-ligero",
];

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function checkAtLeast(actual, minimum, label) {
  check(
    actual >= minimum,
    `${label}: se esperaban al menos ${minimum}, hay ${actual}.`,
  );
}

async function verify() {
  const tables = await prisma.$queryRaw`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `;
  const tableNames = new Set(tables.map(({ name }) => name));
  for (const table of requiredTables) {
    check(tableNames.has(table), `Falta la tabla requerida ${table}.`);
  }

  const [categoryCount, productCount, variantCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.variant.count(),
  ]);
  checkAtLeast(categoryCount, 4, "Categorías");
  checkAtLeast(productCount, 6, "Productos");
  checkAtLeast(variantCount, 18, "Variantes");

  const [categories, products, variants] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, slug: true },
      orderBy: { slug: "asc" },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        categoryId: true,
        category: { select: { slug: true } },
        basePriceCents: true,
      },
      orderBy: { slug: "asc" },
    }),
    prisma.variant.findMany({
      select: {
        id: true,
        sku: true,
        productId: true,
        size: true,
        color: true,
        stock: true,
        priceCents: true,
      },
      orderBy: { sku: "asc" },
    }),
  ]);

  const categorySlugs = new Set(categories.map(({ slug }) => slug));
  for (const slug of requiredCategorySlugs) {
    check(categorySlugs.has(slug), `Falta la categoría de referencia ${slug}.`);
  }

  const productSlugs = new Set(products.map(({ slug }) => slug));
  for (const slug of requiredProductSlugs) {
    check(productSlugs.has(slug), `Falta el producto de referencia ${slug}.`);
  }

  const productIds = new Set(products.map(({ id }) => id));
  const skuSet = new Set();
  const variantCombinationSet = new Set();
  const variantCountByProduct = new Map();
  let availableVariants = 0;
  let soldOutVariants = 0;

  for (const product of products) {
    check(Boolean(product.categoryId), `El producto ${product.slug} no tiene categoría.`);
    check(Boolean(product.category.slug), `La categoría del producto ${product.slug} no tiene slug.`);
    check(
      product.basePriceCents > 0,
      `El precio base de ${product.slug} debe ser positivo.`,
    );
  }

  for (const variant of variants) {
    check(!skuSet.has(variant.sku), `SKU duplicado: ${variant.sku}.`);
    skuSet.add(variant.sku);
    check(productIds.has(variant.productId), `La variante ${variant.sku} no tiene producto.`);
    check(Boolean(variant.size), `La variante ${variant.sku} no tiene talla.`);
    check(Boolean(variant.color), `La variante ${variant.sku} no tiene color.`);
    check(variant.priceCents > 0, `El precio de ${variant.sku} debe ser positivo.`);
    check(variant.stock >= 0, `El stock de ${variant.sku} no puede ser negativo.`);

    const combination = `${variant.productId}:${variant.size}:${variant.color}`;
    check(
      !variantCombinationSet.has(combination),
      `Combinación talla/color duplicada para ${variant.sku}.`,
    );
    variantCombinationSet.add(combination);
    variantCountByProduct.set(
      variant.productId,
      (variantCountByProduct.get(variant.productId) ?? 0) + 1,
    );

    if (variant.stock > 0) {
      availableVariants += 1;
    } else {
      soldOutVariants += 1;
    }
  }

  for (const product of products) {
    check(
      (variantCountByProduct.get(product.id) ?? 0) > 0,
      `El producto ${product.slug} no tiene variantes.`,
    );
  }
  check(availableVariants > 0, "Debe existir al menos una variante disponible.");
  check(soldOutVariants > 0, "Debe existir al menos una variante agotada.");

  if (failures.length > 0) {
    throw new Error(`Verificación fallida:\n- ${failures.join("\n- ")}`);
  }

  console.log(
    `Verificación OK: tablas=${requiredTables.length}, categorías=${categoryCount}, productos=${productCount}, variantes=${variantCount}, disponibles=${availableVariants}, agotadas=${soldOutVariants}.`,
  );
}

verify()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
