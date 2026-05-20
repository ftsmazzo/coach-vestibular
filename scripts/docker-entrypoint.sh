#!/bin/sh
set -e

echo "==> Coach Vestibular — deploy"
echo "==> Aguardando banco..."
sleep 2

echo "==> Aplicando migrations (prisma migrate deploy)..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Executando seed (RUN_SEED=true)..."
  set +e
  RUN_SEED=true npx tsx prisma/seed.ts
  SEED_EXIT=$?
  set -e
  if [ "$SEED_EXIT" -eq 0 ]; then
    echo "==> Seed concluído."
  else
    echo "==> AVISO: seed retornou código $SEED_EXIT — app será iniciado mesmo assim."
  fi
else
  echo "==> Seed ignorado (use RUN_SEED=true apenas no primeiro deploy)."
fi

echo "==> Iniciando Next.js na porta ${PORT:-3000}..."
exec npm run start
