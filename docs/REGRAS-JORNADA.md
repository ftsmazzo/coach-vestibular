# Jornada, modo de uso e colaboração

## Três camadas (implementadas)

| Camada | Onde | O que faz |
|--------|------|-----------|
| **Macro — Jornada** | Dashboard → card *Sua jornada* | Todos os registros com peso por `modoUso`; acerto ponderado e pressão por matéria |
| **Meso — Prova do catálogo** | `/provas/[id]/historico` | Tentativas da mesma prova, gráfico de evolução, melhor/último % |
| **Micro — Registro** | `/simulados/[id]` | Gabarito, diagnóstico, sugestão de classificação |

## Modo de uso (`Exam.modoUso`)

| Valor | Significado | Peso |
|-------|-------------|------|
| `OFICIAL` | ENEM / vestibular “dia D” | 3 |
| `TREINO` | Simulado, lista | 1,5 |
| `REVISAO_PROVA_ANTIGA` | Prova antiga refeita | 1 |

Escolhido pelo aluno em **Registrar resultado**. O admin define o tipo da prova no catálogo; o peso no plano vem da finalidade do registro.

## Plano semanal

- Gerado após cada registro/recálculo a partir do **último exame** + histórico (mesma prova + jornada global para temas recorrentes).
- Com **2+ registros**, o plano ganha o bloco *Panorama da sua jornada* (`src/lib/jornada-plano.ts`).

## Colaboração e ranking

- Aluno: **Classificação errada?** em cada questão do registro.
- Admin: `/admin/sugestoes` — aceitar (+25 XP) ou rejeitar.
- Aluno: `/comunidade` e card no dashboard — ranking por XP.

## Roadmap (próximo)

- Meta de faculdade com peso por banca no plano.
- Medalhas / moeda interna além de XP.
- API de incidência de temas em vestibulares.
