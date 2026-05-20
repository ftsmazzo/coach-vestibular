# Coach Vestibular

Plataforma web de apoio a estudantes de pré-vestibular (foco medicina). Transforma resultados de simulados em diagnóstico por matéria/tema, plano semanal e quests com recompensa emocional.

## Deploy (EasyPanel + PostgreSQL)

Guia completo: **[docs/DEPLOY-EASYPANEL.md](docs/DEPLOY-EASYPANEL.md)**

No deploy, **migrations rodam automaticamente** (`prisma migrate deploy` no startup do container).

### Variáveis no EasyPanel (app)

```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO_POSTGRES:5432/coach_vestibular
JWT_SECRET=sua-chave-secreta-minimo-32-caracteres
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
RUN_SEED=true
```

> `RUN_SEED=true` apenas no **primeiro** deploy; depois use `false`.

Modelo completo: [.env.example](.env.example)

## Desenvolvimento local

### Com Docker (PostgreSQL)

```bash
docker compose up --build
```

### Sem Docker (SQLite)

```bash
npm install
cp .env.example .env
# No .env use: DATABASE_URL="file:./dev.db"
npx prisma migrate deploy
RUN_SEED=true npm run db:seed
npm run dev
```

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build produção |
| `npm run db:migrate:deploy` | Migrations (produção / CI) |
| `npm run db:seed` | Dados iniciais + convites |

## Repositório

https://github.com/ftsmazzo/coach-vestibular
