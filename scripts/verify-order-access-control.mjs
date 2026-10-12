#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaBinary = resolve(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const nextBinary = resolve(root, "node_modules", "next", "dist", "bin", "next");
const trashBinary = "/usr/bin/trash";

const tempDirectory = mkdtempSync("/tmp/verify-order-access-control-");
const databasePath = join(tempDirectory, "orders.db");
const databaseUrl = `file:${databasePath}`;
const runtimeEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
};

let prisma;
let server;
let serverPid;
let serverReady = false;
let serverStartError;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: runtimeEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    fail(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
}

function cookieFor(token) {
  return `auth_session=${encodeURIComponent(token)}`;
}

function requestOptions(options = {}) {
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set("Cookie", cookieFor(options.token));
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: options.redirect ?? "manual",
  };
}

async function http(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, requestOptions(options));
}

async function responseText(response) {
  return response.text();
}

function hasNoStore(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  return /(?:^|,\s*)no-store(?:,|$)/iu.test(cacheControl);
}

function hasPrivateNoStore(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  return /(?:^|,\s*)private(?:,|$)/iu.test(cacheControl) && hasNoStore(response);
}

async function findFreePort() {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = probe.address();
  assert(address && typeof address === "object", "no se pudo reservar un puerto local");
  const port = address.port;
  await new Promise((resolvePromise, reject) => {
    probe.close((error) => (error ? reject(error) : resolvePromise()));
  });
  return port;
}

async function waitForServer(baseUrl) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverStartError) {
      fail("next start no pudo ocupar el puerto aislado");
    }
    if (!server || (server.exitCode !== null && server.exitCode !== undefined)) {
      fail("next start terminó antes de estar disponible");
    }

    if (serverReady) {
      try {
        const response = await fetch(`${baseUrl}/checkout`, { redirect: "manual" });
        if (response.status >= 200 && response.status < 500) {
          await response.arrayBuffer();
          return;
        }
      } catch {
        // The child may still be finishing its listener setup.
      }
    }
    await delay(250);
  }
  fail("next start no respondió en el tiempo esperado");
}

function startServer(port) {
  server = spawn(process.execPath, [nextBinary, "start", "-p", String(port)], {
    cwd: root,
    env: { ...runtimeEnv, PORT: String(port) },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverPid = server.pid;
  serverReady = false;
  serverStartError = undefined;
  server.stdout?.on("data", (chunk) => {
    if (/ready in|started server/iu.test(String(chunk))) {
      serverReady = true;
    }
  });
  server.stderr?.on("data", (chunk) => {
    if (/EADDRINUSE|error listening|failed to start/iu.test(String(chunk))) {
      serverStartError = true;
    }
  });
  server.once("error", () => {
    serverStartError = true;
  });
  // Drain both streams without exposing server HTML, cookies, tokens or request data.
  server.stdout?.resume();
  server.stderr?.resume();
}

async function stopServer() {
  if (!serverPid) {
    return;
  }

  const runningServer = server;
  const runningPid = serverPid;
  try {
    process.kill(-runningPid, "SIGTERM");
  } catch (error) {
    if (!(error instanceof Error) || !/ESRCH/u.test(error.message)) {
      throw error;
    }
  }

  const waitForExit = (timeoutMs) =>
    new Promise((resolvePromise) => {
      if (runningServer.exitCode !== null && runningServer.exitCode !== undefined) {
        resolvePromise(true);
        return;
      }

      let timer;
      const onExit = () => {
        clearTimeout(timer);
        resolvePromise(true);
      };
      timer = setTimeout(() => {
        runningServer.removeListener("exit", onExit);
        resolvePromise(false);
      }, timeoutMs);
      runningServer.once("exit", onExit);
    });

  let exited = await waitForExit(5_000);
  if (!exited) {
    try {
      process.kill(-runningPid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error) || !/ESRCH/u.test(error.message)) {
        throw error;
      }
    }
    exited = await waitForExit(2_000);
  }
  if (!exited) {
    throw new Error("next start no terminó; se conserva la ruta temporal para inspección");
  }

  server = undefined;
  serverPid = undefined;
}

async function createFixture() {
  const now = Date.now();
  const userA = await prisma.user.create({
    data: {
      id: "user-a",
      email: "order-access-a@example.test",
      passwordHash: "fixture-password-hash",
      name: "Order access A",
    },
  });
  const userB = await prisma.user.create({
    data: {
      id: "user-b",
      email: "order-access-b@example.test",
      passwordHash: "fixture-password-hash",
      name: "Order access B",
    },
  });

  const variants = await prisma.variant.findMany({
    where: { stock: { gt: 2 } },
    orderBy: { sku: "asc" },
    take: 2,
    select: {
      id: true,
      size: true,
      color: true,
      priceCents: true,
      stock: true,
      product: { select: { name: true } },
    },
  });
  assert(variants.length === 2, "el seed no ofrece dos variantes disponibles para el smoke");

  await prisma.cart.create({
    data: {
      id: "cart-a",
      userId: userA.id,
      items: {
        create: {
          id: "cart-item-a",
          variantId: variants[0].id,
          quantity: 1,
        },
      },
    },
  });

  await prisma.order.create({
    data: {
      id: "order-a",
      userId: userA.id,
      status: "PAID",
      totalCents: variants[0].priceCents,
      lines: {
        create: {
          id: "order-line-a",
          variantId: variants[0].id,
          productName: variants[0].product.name,
          size: variants[0].size,
          color: variants[0].color,
          quantity: 1,
          unitPriceCents: variants[0].priceCents,
        },
      },
    },
  });
  await prisma.order.create({
    data: {
      id: "order-b",
      userId: userB.id,
      status: "PAID",
      totalCents: variants[1].priceCents,
      lines: {
        create: {
          id: "order-line-b",
          variantId: variants[1].id,
          productName: variants[1].product.name,
          size: variants[1].size,
          color: variants[1].color,
          quantity: 1,
          unitPriceCents: variants[1].priceCents,
        },
      },
    },
  });

  const tokens = {
    a: "order-access-token-a",
    b: "order-access-token-b",
    expired: "order-access-token-expired",
    revoked: "order-access-token-revoked",
    unknown: "order-access-token-unknown",
  };
  await prisma.session.createMany({
    data: [
      {
        id: "session-a",
        tokenHash: hashToken(tokens.a),
        userId: userA.id,
        expiresAt: new Date(now + 60 * 60 * 1000),
      },
      {
        id: "session-b",
        tokenHash: hashToken(tokens.b),
        userId: userB.id,
        expiresAt: new Date(now + 60 * 60 * 1000),
      },
      {
        id: "session-expired",
        tokenHash: hashToken(tokens.expired),
        userId: userA.id,
        expiresAt: new Date(now - 1),
      },
      {
        id: "session-revoked",
        tokenHash: hashToken(tokens.revoked),
        userId: userA.id,
        expiresAt: new Date(now + 60 * 60 * 1000),
      },
    ],
  });
  await prisma.session.delete({ where: { id: "session-revoked" } });

  return { tokens, initialOrderCount: 2 };
}

async function verifyHttp(baseUrl, fixture) {
  const invalidTokens = [
    ["guest", undefined],
    ["unknown", fixture.tokens.unknown],
    ["expired", fixture.tokens.expired],
    ["revoked", fixture.tokens.revoked],
  ];

  for (const [label, token] of invalidTokens) {
    for (const path of ["/orders", "/orders/order-a"]) {
      const response = await http(baseUrl, path, { token });
      assert(response.status === 307, `${label} ${path} no redirige (status ${response.status})`);
      assert(
        new URL(response.headers.get("location") ?? "/", baseUrl).pathname === "/checkout",
        `${label} ${path} redirige a una ruta inesperada`,
      );
      await response.arrayBuffer();
    }
  }

  const listA = await http(baseUrl, "/orders", { token: fixture.tokens.a });
  const listABody = await responseText(listA);
  assert(listA.status === 200, `A /orders devuelve ${listA.status}`);
  assert(hasPrivateNoStore(listA), "A /orders no devuelve private/no-store");
  assert(listABody.includes("order-a"), "A /orders no contiene el pedido propio");
  assert(!listABody.includes("order-b"), "A /orders filtra el pedido de B");

  const listB = await http(baseUrl, "/orders", { token: fixture.tokens.b });
  const listBBody = await responseText(listB);
  assert(listB.status === 200, `B /orders devuelve ${listB.status}`);
  assert(hasPrivateNoStore(listB), "B /orders no devuelve private/no-store");
  assert(listBBody.includes("order-b"), "B /orders no contiene el pedido propio");
  assert(!listBBody.includes("order-a"), "B /orders reutiliza HTML de A");

  const detailA = await http(baseUrl, "/orders/order-a", { token: fixture.tokens.a });
  const detailABody = await responseText(detailA);
  assert(detailA.status === 200, `A detalle devuelve ${detailA.status}`);
  assert(hasPrivateNoStore(detailA), "A detalle no devuelve private/no-store");
  assert(
    detailABody.includes("Detalle del pedido"),
    `A detalle no contiene la vista de pedido (len=${detailABody.length}, title=${detailABody.includes("Detalle del pedido")})`,
  );

  const foreign = await http(baseUrl, "/orders/order-b", { token: fixture.tokens.a });
  const foreignBody = await responseText(foreign);
  const missing = await http(baseUrl, "/orders/order-missing", { token: fixture.tokens.a });
  const missingBody = await responseText(missing);
  assert(foreign.status === 404 && missing.status === 404, "foreign/missing no comparten 404");
  assert(
    foreignBody.replaceAll("order-b", "order-id") ===
      missingBody.replaceAll("order-missing", "order-id"),
    "foreign/missing no tienen una respuesta 404 indistinguible",
  );
  assert(!foreignBody.includes("Detalle del pedido"), "foreign filtra HTML de pedido");

  const identityQuery = await http(baseUrl, "/orders?userId=user-b", { token: fixture.tokens.a });
  const identityQueryBody = await responseText(identityQuery);
  assert(identityQuery.status === 200, "userId en query rompe la lista");
  assert(identityQueryBody.includes("order-a") && !identityQueryBody.includes("order-b"), "userId en query altera el propietario");

  const rscA = await http(baseUrl, "/orders", {
    token: fixture.tokens.a,
    headers: {
      RSC: "1",
      Accept: "text/x-component",
    },
  });
  const rscABody = await responseText(rscA);
  assert(rscA.status === 200, `RSC de A devuelve ${rscA.status}`);
  assert(rscABody.includes("order-a") && !rscABody.includes("order-b"), "RSC de A mezcla pedidos");

  const countBeforeInvalidPayment = await prisma.order.count();
  for (const [label, token] of invalidTokens) {
    const response = await http(baseUrl, "/api/checkout/payment", {
      method: "POST",
      token,
      headers: { "Idempotency-Key": `invalid-${label}` },
      body: { outcome: "approved" },
    });
    assert(response.status === 401, `${label} payment devuelve ${response.status}`);
    assert(hasNoStore(response), `${label} payment no devuelve no-store`);
    await response.arrayBuffer();
  }

  const injectedIdentity = await http(baseUrl, "/api/checkout/payment", {
    method: "POST",
    token: fixture.tokens.a,
    headers: { "Idempotency-Key": "injected-user-id" },
    body: { outcome: "approved", userId: "user-b" },
  });
  assert(injectedIdentity.status === 400, "payment acepta userId controlado por el navegador");
  await injectedIdentity.arrayBuffer();
  assert(
    (await prisma.order.count()) === countBeforeInvalidPayment,
    "una sesión inválida o un userId inyectado creó un pedido",
  );

  const payment = await http(baseUrl, "/api/checkout/payment", {
    method: "POST",
    token: fixture.tokens.a,
    headers: { "Idempotency-Key": "valid-order-access-payment" },
    body: { outcome: "approved" },
  });
  assert(payment.status === 200, `payment válido devuelve ${payment.status}`);
  assert(hasNoStore(payment), "payment válido no devuelve no-store");
  await payment.arrayBuffer();
  assert((await prisma.order.count()) === countBeforeInvalidPayment + 1, "payment válido no creó un único pedido");

  const logout = await http(baseUrl, "/api/auth/logout", {
    method: "POST",
    token: fixture.tokens.a,
  });
  assert(logout.status === 200, `logout devuelve ${logout.status}`);
  assert(hasNoStore(logout), "logout no devuelve no-store");
  assert((logout.headers.get("set-cookie") ?? "").includes("auth_session=;"), "logout no expira la cookie");
  await logout.arrayBuffer();

  const afterLogoutList = await http(baseUrl, "/orders", { token: fixture.tokens.a });
  assert(afterLogoutList.status === 307, "el token antiguo sigue viendo la lista tras logout");
  await afterLogoutList.arrayBuffer();
  const afterLogoutPayment = await http(baseUrl, "/api/checkout/payment", {
    method: "POST",
    token: fixture.tokens.a,
    headers: { "Idempotency-Key": "after-logout" },
    body: { outcome: "approved" },
  });
  assert(afterLogoutPayment.status === 401, "el token antiguo puede pagar tras logout");
  await afterLogoutPayment.arrayBuffer();
  assert((await prisma.order.count()) === countBeforeInvalidPayment + 1, "logout permitió crear otro pedido");
}

async function main() {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  writeFileSync(databasePath, "");
  run(prismaBinary, ["migrate", "deploy"], "migraciones aisladas");
  run(prismaBinary, ["db", "seed"], "seed aislado");

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
  await prisma.$connect();
  const fixture = await createFixture();

  startServer(port);
  await waitForServer(baseUrl);
  await verifyHttp(baseUrl, fixture);

  console.log(
    `order-access-control smoke OK: db=${databasePath}, initialOrders=${fixture.initialOrderCount}, cache=private/no-store, cleanup=pending`,
  );
}

let failure;
let cleanupAllowed = true;
try {
  await main();
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try {
    await stopServer();
  } catch (error) {
    failure ??= error instanceof Error ? error.message : String(error);
    cleanupAllowed = false;
  }
  try {
    await prisma?.$disconnect();
  } catch (error) {
    failure ??= error instanceof Error ? error.message : String(error);
  }

  if (!cleanupAllowed) {
    console.error(`order-access-control smoke cleanup skipped; conserva: ${tempDirectory}`);
  } else {
    const cleanup = spawnSync(trashBinary, [tempDirectory], {
      cwd: dirname(tempDirectory),
      stdio: "ignore",
    });
    if (cleanup.status !== 0 || existsSync(tempDirectory)) {
      failure ??= `cleanup con trash falló para ${tempDirectory}`;
      console.error(`order-access-control smoke cleanup failed: ${tempDirectory}`);
    } else {
      console.log(`order-access-control smoke cleanup OK: ${tempDirectory}`);
    }
  }
}

if (failure) {
  console.error(`order-access-control smoke FAILED: ${failure}`);
  process.exitCode = 1;
}
