# Jornada, modo de uso e colaboração

## Três camadas

| Camada | Onde | O que faz |
|--------|------|-----------|
| **Macro — Jornada** | Dashboard → *Sua jornada* | Registros com peso por `modoUso` e banca alinhada à meta |
| **Meso — Prova do catálogo** | `/provas/[id]/historico` | Tentativas, evolução, melhor % |
| **Micro — Registro** | `/simulados/[id]` | Gabarito, diagnóstico, sugestões |

## Modo de uso (`Exam.modoUso`)

| Valor | Peso |
|-------|------|
| `OFICIAL` | 3 |
| `TREINO` | 1,5 |
| `REVISAO_PROVA_ANTIGA` | 1 |

## Meta de vestibular (`/perfil`)

- **Curso alvo** + **prova/banca meta** (ex.: Medicina · UFU 2026).
- Erros em provas cuja **banca** combina com a meta ganham **+25%** de peso na jornada e no bloco do plano.
- Palavras-chave: ENEM, UFU, UNICAMP, USP/FUVEST, UNESP, ITA, etc.

## Plano semanal

- Último registro + histórico (mesma prova + jornada global).
- Com 2+ registros: bloco *Panorama da sua jornada* (inclui meta/banca se configurada).

## Colaboração e XP

| Ação | XP |
|------|-----|
| Melhoria ≥10 p.p. em matéria (vs registro anterior da mesma prova) | +10 |
| Todas as quests práticas da semana concluídas | +50 |
| Sugestão de classificação aceita | +25 |

- **Ranking:** apelidos `Estudante L.ab.cd` (sem nome completo).
- `/comunidade`, `/perfil` — como ganhar XP e histórico recente.

## Roadmap (ainda não feito)

- API externa de incidência de temas em vestibulares.
- Loja / moeda além de XP.
- Plano 100% gerado só pela jornada agregada (sem depender só do último registro).
