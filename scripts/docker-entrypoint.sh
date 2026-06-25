#!/bin/sh
set -e

echo "==> Coach Vestibular — deploy"
echo "==> Aguardando banco..."
sleep 2

# migrate também roda via npm prestart (se o painel ignorar ENTRYPOINT e chamar só npm start)
mkdir -p data/uploads

echo "==> Aplicando migrations (prisma migrate deploy)..."
npx prisma migrate deploy || {
  echo "==> ERRO: migrate deploy falhou. Verifique DATABASE_URL e logs do Postgres."
  exit 1
}

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

if [ "$CONFIRMAR_RESET" = "true" ]; then
  echo "==> Reset motor v1 (CONFIRMAR_RESET=true) — preserva logins, apaga jornada + catálogo + corpus…"
  set +e
  CONFIRMAR_RESET=true npx tsx scripts/reset-ambiente-fresco.ts
  RESET_EXIT=$?
  set -e
  if [ "$RESET_EXIT" -eq 0 ]; then
    echo "==> Reset concluído."
  else
    echo "==> AVISO: reset retornou código $RESET_EXIT — app será iniciado mesmo assim."
  fi
fi

if [ "$CONFIRMAR_RESET" = "true" ] || [ "$SKIP_ENEM_SYNC" = "true" ]; then
  echo "==> Sync ENEM e Linguagens ignorados (reset ou SKIP_ENEM_SYNC=true)."
else
  echo "==> Corpus ENEM (enem.dev) — sync unificado em background se necessário..."
  npx tsx scripts/sync-enem-corpus.ts --if-incomplete >> /tmp/enem-sync.log 2>&1 &
  echo "==> Sync ENEM rodando em background (log: /tmp/enem-sync.log). App sobe sem aguardar."

  echo "==> Linguagens — reparo de rota + reclassificação IA em background..."
  npx tsx scripts/deploy-enem-linguagens.ts >> /tmp/enem-linguagens.log 2>&1 &
  echo "==> Manutenção Linguagens em background (log: /tmp/enem-linguagens.log)."
fi

echo "==> Iniciando Next.js na porta ${PORT:-3000}..."
exec npm run start
