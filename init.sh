#!/usr/bin/env bash
set -euo pipefail

echo "==> Repositorio: $(pwd)"

echo "==> Verificando requisitos (node / pnpm)"
command -v node >/dev/null 2>&1 || { echo "Error: node no encontrado."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm no encontrado."; exit 1; }
echo "    node $(node --version) / pnpm $(pnpm --version)"

echo "==> Instalando dependencias"
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

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
