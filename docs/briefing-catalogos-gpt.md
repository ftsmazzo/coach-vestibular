# Briefing para GPT — Catálogos de classificação N2 (Coach Vestibular)

Use este documento como contexto principal. Anexe também os arquivos de `data/conhecimento-catalog/` listados no final.

---

## O que estamos construindo

**Coach Vestibular** — sistema que cadastra provas, extrai enunciados, classifica cada questão em um **escopo pedagógico N2** (`escopoId`) e gera diagnóstico + plano de estudo.

**Fonte de verdade pedagógica:** `escopoId` (ex.: `mat.aritmetica.numeros.porcentagem`, `hist.brasil.republica.vargas`).

**Legado (só UI):** `materiaId` / `temaId` em `data/taxonomy.json` — não devem guiar classificação.

---

## Por que redefinimos o plano

Problemas no pipeline antigo:

- Classificação junto com extração, com enunciado truncado
- Catálogos **agregados** (`humanas`, `linguagens`) gerando erros grotescos
- Regex legado reescrevendo matéria por palavra solta no texto
- Fallback silencioso para Biologia/Linguagens

**Decisão:** pipeline em etapas, catálogo **por disciplina**, roteamento prova-agnóstico antes do N2.

---

## Pipeline atual (estado em jun/2026)

```
PDF → Extração literal (enunciado + alternativas + área)
    → Grava banco SEM classificação
    → Admin valida/corrige na tela
    → extracaoValidada = true
    → [PRÓXIMO] Roteamento disciplinar
    → [PRÓXIMO] Classificação N2 no catálogo correto
    → Diagnóstico por escopoId
```

Classificação **só roda** após extração validada, com enunciado completo + alternativas.

---

## Catálogos existentes

| Status | Catálogo | Prefixo | Arquivo |
|--------|----------|---------|---------|
| ✅ OK | Biologia | `bio.*` | `catalogo-biologia-v1.2.0.json` |
| ✅ OK | Química | `quim.*` | `catalogo-quimica-v1.2.1.json` |
| ✅ OK | Física | `fis.*` | `catalogo-fisica-v1.2.0.json` |
| ✅ OK | Matemática | `mat.*` | `catalogo-matematica-v1.2.0.json` |
| ⚠️ Agregar | Humanas | `hum.*` | `catalogo-humanas-v1.2.0.json` |
| ⚠️ Agregar | Linguagens | `ling.*` | `catalogo-linguagens-v1.2.0.json` |

**Spec de roteamento (modelo):** `roteamento-linguagens-v1.0.json`

---

## O que precisamos criar (Sprint 1)

### Catálogos por disciplina (JSON v1.2.0)

- `historia` → `hist.*`
- `geografia` → `geo.*`
- `filosofia` → `fil.*`
- `sociologia` → `soc.*`
- `portugues` → `pt.*`
- `ingles` → `ing.*`
- `espanhol` → `esp.*`

### Specs de roteamento

- `roteamento-humanas-v1.0.json` — hist | geo | fil | soc pelo conteúdo cobrado
- `roteamento-linguagens-v2.0.json` — pt | ing | esp antes do N2

### Prompts (`.md`)

Um por disciplina, no padrão de `prompt-classificacao-mat-v1.2.md`.

### Migração documentada

Tabela `hum.antigo.id` → `hist|geo|fil|soc.novo.id` e `ling.*` → `pt|ing|esp.*`.

---

## Schema do catálogo v1.2.0

Referência ouro: `catalogo-matematica-v1.2.0.json`.

Hierarquia: **assunto → domínio (N1) → escopo (N2)**

Campos obrigatórios por escopo N2:

| Campo | Função |
|-------|--------|
| `id` | Imutável após publicar |
| `label` | Nome legível |
| `descricao` | **Mais forte** — cobre / NÃO cobre |
| `keywords` | Peso 1.0 |
| `keywordsContexto` | Peso 0.4 |
| `exemplosEnunciado` | Referência semântica |
| `negativeHints` | Penaliza este escopo |
| `naoConfundirCom` | IDs de escopos irmãos |
| `regraDesempate` | Desempate entre irmãos |

Fallback por disciplina: `{prefixo}.__nao_classificado` (ex.: `hist.__nao_classificado`).

Regras globais em `regras`: `confiancaMinima: 0.45`, `maxN2PorMateria: 80`, etc.

---

## Regras de classificação (prova-agnósticas)

1. Nunca inventar IDs
2. Classificar pelo **conhecimento exigido**, não pelo tema superficial
3. Ignorar palavras soltas de contexto (ex.: "OMS" em texto de espanhol)
4. **Sem regras por posição** no caderno
5. **Roteamento antes de N2** em áreas agregadas
6. Linguagens: ignorar PT do comando; decidir pela língua do texto-base + alternativas

---

## Migração dos agregados

### De `catalogo-humanas-v1.2.0.json`

| assuntoId atual | Catálogo destino |
|-----------------|------------------|
| `historia_brasil`, `historia_geral` | `historia` |
| `geografia` | `geografia` |
| `filosofia` | `filosofia` |
| `sociologia` | `sociologia` |

Revisar cada escopo — não copiar cegamente. Reforçar `negativeHints` cruzados entre disciplinas.

### De `catalogo-linguagens-v1.2.0.json`

| assuntoId atual | Catálogo destino |
|-----------------|------------------|
| `pt_interp`, `pt_lit`, `pt_gram`, `pt_sem`, `pt_art`, `pt_tec` | `portugues` |
| `l2_en` | `ingles` |
| `l2_es` | `espanhol` |

---

## Entregáveis por fase

### Fase 1 — Humanas (prioridade)

1. Outline de `historia` (assuntos → domínios → escopos + 1 linha de descrição)
2. Após validação: JSON completo + prompt + 10 casos de teste
3. Repetir para geo, fil, soc
4. `roteamento-humanas-v1.0.json`

### Fase 2 — Linguagens

1. Catálogos `portugues`, `ingles`, `espanhol`
2. `roteamento-linguagens-v2.0.json`
3. Prompts + casos de teste

### Casos de teste (por disciplina)

10 questões com: enunciado fictício, `escopoId` esperado, escopo que **não** deve ser escolhido, justificativa em 1 frase.

---

## Critérios de qualidade

- Todo escopo com `descricao` explícita (cobre / NÃO cobre)
- `naoConfundirCom` bidirecional entre irmãos
- Prefixo correto da disciplina (`hist.`, não `hum.`)
- JSON válido, pronto para `data/conhecimento-catalog/`
- Máx. 80 escopos N2 por disciplina (fallback não conta)

---

## Primeira pergunta ao GPT

> Com base neste briefing e nos arquivos anexos, produza um **outline completo** do catálogo `historia` v1.0.0: lista de `assuntoId` → domínios → escopos N2 com `label` e uma linha de `descricao` cada. **Não gere o JSON inteiro ainda** — queremos validar granularidade antes.

---

## Anexos recomendados

- `data/conhecimento-catalog/catalogo-matematica-v1.2.0.json`
- `data/conhecimento-catalog/catalogo-humanas-v1.2.0.json`
- `data/conhecimento-catalog/catalogo-linguagens-v1.2.0.json`
- `data/conhecimento-catalog/roteamento-linguagens-v1.0.json`
- `data/conhecimento-catalog/prompt-classificacao-mat-v1.2.md`
- `data/taxonomy.json`
