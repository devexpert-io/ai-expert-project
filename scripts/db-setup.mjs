import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envPath = resolve(root, ".env");
const envExamplePath = resolve(root, ".env.example");
const prismaBinary = resolve(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envContents = readFileSync(envPath, "utf8");
  const match = envContents.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return match?.[1];
}

function ensureSqliteFile() {
  const databaseUrl = readDatabaseUrl();
  if (!databaseUrl?.startsWith("file:")) {
    return;
  }

  const rawPath = databaseUrl.slice("file:".length).split("?", 1)[0];
  if (!rawPath || rawPath === ":memory:") {
    return;
  }

  const databasePath = resolve(root, "prisma", decodeURIComponent(rawPath));
  if (existsSync(databasePath)) {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
  closeSync(openSync(databasePath, "a"));
  console.log("==> Archivo SQLite local creado para aplicar la migración");
}

function runPrisma(args) {
  const path = [resolve(root, "node_modules", ".bin"), process.env.PATH]
    .filter(Boolean)
    .join(delimiter);
  const result = spawnSync(prismaBinary, args, {
    cwd: root,
    env: { ...process.env, PATH: path },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  if (!existsSync(envPath)) {
    if (!existsSync(envExamplePath)) {
      throw new Error("No existe .env.example para preparar el entorno local.");
    }

    copyFileSync(envExamplePath, envPath);
    console.log("==> .env creado desde .env.example (sin sobrescribir un .env existente)");
  }

  ensureSqliteFile();

  console.log("==> Generando Prisma Client");
  runPrisma(["generate"]);

  console.log("==> Aplicando migraciones pendientes");
  runPrisma(["migrate", "deploy"]);

  console.log("==> Cargando seed del catálogo");
  runPrisma(["db", "seed"]);

  console.log("Base de datos preparada.");
} catch (error) {
  console.error("Error al preparar la base de datos:", error);
  process.exitCode = 1;
}
