# Jornada, modo de uso e colaboração

## Três camadas

| Camada | Onde | O que faz |
|--------|------|-----------|
| **Macro — Jornada** | Dashboard (copiloto) | Aprendizado agregado — **sem** comparar provas/bancas diferentes |
| **Meso — Prova do catálogo** | `/provas/[id]/historico`, `/lente` | Tentativas na mesma prova |
| **Micro — Registro** | `/simulados/[id]` | Gabarito, diagnóstico, sugestões |

## Home = copiloto (não analytics)

A `/dashboard` responde: *o que fazer agora?* — missão, estado, padrão de erro, alavancas.

**Não na Home:** comparativo entre vestibulares, gráficos mistos, evolução entre provas distintas.

Comparações válidas: mesma prova (histórico/lente) ou futuro hub por **banca** (`Prova.banca`).

Agregadores: `aggregateJourneyLearning()` (dados) + `buildJourneyInsight()` (síntese) — `context: JOURNEY`.

Widgets na Home usam `mode: "HOME"` (menos botões, sem XP no detalhe colapsado).

## Hierarquia pedagógica (diagnóstico)

| Nível | Campo | Papel |
|-------|--------|--------|
| 1 | **Conhecimento exigido** | O que a questão exige cognitivamente — eixo do diagnóstico |
| 2 | **Tipo cognitivo** | Inferido (`interpretação`, `modelagem`, `visualização`…) via `tipo-cognitivo.ts` |
| 3 | **Matéria** | Contexto curricular (“em Biologia”) |
| 4 | **Assunto** | Indexador / catálogo — não centro da inteligência |

Home: `aggregateKnowledgeGaps()` + `aggregateCognitiveClusters()`. Gargalo = frase cognitiva, não “Matemática 40%”. Quests `[Alavanca]` priorizam clusters cognitivos.

**Plano global:** montado com `planoSoJornada` (toda a jornada, não só o último registro). Ao excluir um `Exam`, o plano e as quests da semana são recriados. Botão *Atualizar plano pela jornada* em `/plano`.

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

- Hub por banca (`Prova.banca`) — após validar a Home com alunos.
- Página de analytics detalhado (reutilizar `CoachPanoramaJornada` fora da Home).
- API externa de incidência de temas em vestibulares.
- Loja / moeda além de XP.
- Plano 100% gerado só pela jornada agregada (sem depender só do último registro).
