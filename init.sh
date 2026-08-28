#!/usr/bin/env bash
set -euo pipefail

echo "==> Repositorio: $(pwd)"

echo "==> Verificando requisitos (node / pnpm)"
command -v node >/dev/null 2>&1 || { echo "Error: node no encontrado."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm no encontrado."; exit 1; }

node_major="$(node -p "process.versions.node.split('.')[0]")"
pnpm_version="$(pnpm --version)"

if [ "$node_major" != "22" ]; then
  echo "Error: Prisma 6 requiere el runtime soportado de este proyecto (Node 22; ver .nvmrc)."
  echo "Versión activa: $(node --version)."
  exit 1
fi

if [ "$pnpm_version" != "10.18.3" ]; then
  echo "Error: se requiere pnpm 10.18.3 (ver packageManager en package.json)."
  echo "Versión activa: $pnpm_version."
  exit 1
fi

echo "    node $(node --version) / pnpm $pnpm_version"

echo "==> Instalando dependencias"
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

echo "==> Preparando base de datos"
pnpm db:setup

echo "==> Verificando seed"
pnpm db:verify

echo "==> Lint"
pnpm lint

echo "==> Typecheck"
pnpm typecheck

echo "==> Tests"
pnpm test

echo "==> Build"
pnpm build

echo ""
echo "Verificación base OK."
echo "Para arrancar en local: pnpm dev"
