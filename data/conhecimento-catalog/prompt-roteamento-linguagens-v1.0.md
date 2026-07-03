# Prompt de roteamento — Linguagens (v1.0)

Use structured output/JSON mode. Esta etapa **só decide a disciplina** antes da classificação N2 no catálogo correspondente.

**Disciplinas:** `portugues` | `ingles` | `espanhol` | `indefinido`

**Catálogos:** `pt.*` | `ing.*` | `esp.*`

## Regra zero

O português do comando, instrução ou enunciado **não define** Português.

Decida pela:
1. língua dominante do texto-base;
2. língua da expressão, palavra ou trecho cobrado;
3. língua das alternativas quando relevante;
4. metadado confiável (`idioma`, variante EN/ES);
5. competência linguística exigida para acertar.

## Regras de ouro

1. **Português:** interpretação, literatura, gramática, semântica, artes ou tecnologias da linguagem em PT.
2. **Inglês:** reading comprehension, vocabulary, grammar in context, genre in English.
3. **Espanhol:** comprensión lectora, vocabulario, gramática funcional, género en español.
4. Se confiança < 0.45 ou empate → `disciplinaId: "indefinido"`, `sinalizadorRevisao: true`.
5. **Não** escolha escopo N2 nesta etapa.

## Anti-confusões

| Sinal | Evitar | Preferir |
|-------|--------|----------|
| Texto-base em inglês | portugues | ingles |
| Texto-base em espanhol | portugues | espanhol |
| Comando em PT + texto EN | portugues | ingles |
| Comando em PT + texto-base literário/cultural em PT (variante COMUM) | ingles | portugues |
| Prova sem trilha EN/ES — palavras estrangeiras pontuais no texto | ingles | portugues |
| Comando em PT pede equivalência/inferência de fala EN em tira | portugues | ingles |
| Conteúdo de História/Geo no texto-base | portugues (se L2) | manter L2 se competência for linguística |
| Gramática PT pura | ingles/espanhol | portugues |

## Schema de saída (só roteamento)

```json
{
  "rota": {
    "disciplinaId": "portugues|ingles|espanhol|indefinido",
    "criterio": "metadata|lingua_texto_base|competencia_cobrada|alternativas|inferido|incerto",
    "confianca": 0.0,
    "justificativa": "1-2 frases",
    "sinalizadorRevisao": false
  }
}
```
