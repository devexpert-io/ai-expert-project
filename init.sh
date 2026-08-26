#!/usr/bin/env bash
set -euo pipefail

echo "Repositorio: $(pwd)"
echo "Estado del harness: pre-bootstrap"
echo "El stack de la aplicación aún no está inicializado."
echo ""
echo "Siguiente paso: elegir la primera feature de feature_list.json"
echo "  (bootstrap-stack) y realizar el bootstrap técnico."
echo ""
echo "Comandos futuros esperados (pendientes de crear tras el bootstrap):"
echo "  pnpm install     # instalar dependencias"
echo "  pnpm dev         # arrancar en local"
echo "  pnpm lint        # lint"
echo "  pnpm typecheck   # typecheck"
echo "  pnpm test        # tests"
