#!/usr/bin/env bash
set -euo pipefail

echo "==> Repositorio: $(pwd)"

echo "==> Verificando requisitos (pnpm)"
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm no encontrado."; exit 1; }

# pnpm >= 9.7 cambia solo a la versión fijada en packageManager (package.json).
pnpm_version="$(pnpm --version)"
if [ "$pnpm_version" != "10.18.3" ]; then
  echo "Error: se requiere pnpm 10.18.3 (ver packageManager en package.json)."
  echo "Versión activa: $pnpm_version. Actualiza pnpm o usa corepack."
  exit 1
fi

echo "==> Instalando dependencias (pnpm descarga Node 22 si hace falta)"
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

# Los scripts usan el Node de devEngines.runtime, no necesariamente el del sistema.
node_version="$(pnpm exec node --version)"
if [ "${node_version%%.*}" != "v22" ]; then
  echo "Error: Prisma 6 requiere Node 22 (ver devEngines.runtime en package.json)."
  echo "Versión activa en pnpm: $node_version."
  exit 1
fi
echo "    node $node_version / pnpm $pnpm_version"

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
