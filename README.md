# Coach Vestibular

Plataforma web de apoio a estudantes de pré-vestibular (foco medicina). Transforma resultados de simulados em diagnóstico por matéria/tema, plano semanal e quests com recompensa emocional.

## Funcionalidades (MVP)

- Registro manual de gabarito (acerto/erro por questão)
- Importação CSV (template em `docs/templates/`)
- Motor de diagnóstico por regras (sem IA obrigatória)
- Dashboard com evolução e focos da semana
- Plano de estudo automático (modo recuperação após simulado difícil)
- Quests vinculadas ao diagnóstico
- Beta fechado com códigos de convite
- Upload de prova (Fase 2 — stub + API narrativa opcional com `OPENAI_API_KEY`)

## Requisitos

- Node.js 20+
- npm

## Instalação

```bash
cd coach-vestibular
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Contas demo (após seed)

| Papel | E-mail | Senha |
|-------|--------|-------|
| Aluna | aluna@coach.local | demo1234 |
| Admin | admin@coach.local | demo1234 |

**Convites para novos cadastros:** `MED2026-BETA`, `COACH-FAMILIA`

## Estrutura

- `data/taxonomy.json` — matérias, temas e tipos de erro
- `data/exemplo-simulado.json` — simulado de validação
- `docs/validacao-simulado.md` — guia para validar com a estudante
- `docs/wireframes.md` — wireframes das telas
- `src/lib/diagnosis.ts` — motor de regras
- `src/lib/study-plan.ts` — gerador de plano e quests

## PostgreSQL (produção)

No `.env`, troque para:

```
DATABASE_URL="postgresql://user:pass@host:5432/coach"
```

Altere `provider` em `prisma/schema.prisma` para `postgresql` e rode `npx prisma migrate dev`.

## Variáveis opcionais

```
JWT_SECRET=...
OPENAI_API_KEY=...   # narrativa empática (Fase 2)
```

## Privacidade

Dados de desempenho e check-in emocional são sensíveis. O app não substitui acompanhamento psicológico. Ver mensagem em `src/lib/messages.ts`.
