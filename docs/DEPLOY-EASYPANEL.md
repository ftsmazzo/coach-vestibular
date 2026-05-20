# Deploy no EasyPanel (VPS)

## Serviços necessários

| Serviço | Tipo no EasyPanel | Obrigatório |
|---------|-------------------|-------------|
| **PostgreSQL** | App Template Postgres 16 | Sim |
| **Coach Vestibular** | App from GitHub / Dockerfile | Sim |
| Redis | — | Não (Fase 2) |

## 1. Criar PostgreSQL

1. EasyPanel → **Create Service** → **PostgreSQL**
2. Defina usuário, senha e database, por exemplo:
   - Database: `coach_vestibular`
   - User: `coach`
   - Password: *(senha forte)*
3. Anote a **URL de conexão interna** (hostname costuma ser o nome do serviço, ex.: `coach-db` ou `postgres-coach`).

Exemplo de URL:

```text
postgresql://coach:SUA_SENHA@coach-db:5432/coach_vestibular
```

> Use sempre o host **interno** da rede Docker do EasyPanel, não `localhost`.

## 2. Criar o App (Next.js)

1. **Create Service** → **App**
2. Fonte: repositório `https://github.com/ftsmazzo/coach-vestibular`
3. Método de build: **Dockerfile** (raiz do repo)
4. Porta do container: **3000**
5. Domínio: configure HTTPS no proxy do EasyPanel

## 3. Variáveis de ambiente (cole no app)

```env
DATABASE_URL=postgresql://coach:SUA_SENHA@NOME_DO_SERVICO_POSTGRES:5432/coach_vestibular
JWT_SECRET=cole-aqui-minimo-32-caracteres-aleatorios
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
RUN_SEED=true
```

> **Atenção:** `HOSTNAME` deve ser `0.0.0.0` (porta do Next.js no container). **Não** use o host do Postgres nem a URL HTTPS do EasyPanel aqui.

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL interna do Postgres criado no passo 1 |
| `JWT_SECRET` | Segredo forte; não reutilize em outros projetos |
| `RUN_SEED` | `true` só no **primeiro** deploy; depois mude para `false` |
| `OPENAI_API_KEY` | Opcional (Fase 2) |

### Após o primeiro deploy com sucesso

1. Altere `RUN_SEED=false` e salve/redeploy.
2. O seed cria contas demo e convites — em produção real, troque senhas ou remova demos.

**Convites criados pelo seed:** `MED2026-BETA`, `COACH-FAMILIA`  
**Admin demo:** `admin@coach.local` / `demo1234` *(troque em produção)*

## 4. O que acontece no deploy

O script `scripts/docker-entrypoint.sh` executa automaticamente:

1. `npx prisma migrate deploy` — aplica migrations no Postgres
2. Seed (se `RUN_SEED=true`)
3. `npm run start` — sobe o Next.js

Não é necessário rodar migrations manualmente após configurar o env.

## 5. Testar localmente (Docker Compose)

```bash
docker compose up --build
```

Acesse http://localhost:3000

## 6. Troubleshooting

| Erro | Solução |
|------|---------|
| `Can't reach database` | Confira host interno do Postgres na `DATABASE_URL` |
| `P1001` / timeout | App e Postgres devem estar na mesma rede EasyPanel |
| Migrations falham | Verifique se o banco `coach_vestibular` existe |
| Seed não roda | Defina `RUN_SEED=true` e redeploy |
| Build falha no Prisma | Rebuild após push; `prisma generate` roda no Dockerfile |

## 7. Atualizações futuras

Push no GitHub → redeploy no EasyPanel. Novas migrations em `prisma/migrations/` serão aplicadas automaticamente no startup.
