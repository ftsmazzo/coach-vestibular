# Prompt de roteamento — Área macro (v1.0)

Use structured output/JSON mode. Esta etapa **só decide a área macro** (bloco ENEM) antes do roteamento disciplinar N1.

**Áreas:** `linguagens` | `humanas` | `natureza` | `exatas` | `indefinido`

## Regra zero

Decida pelo **conhecimento exigido no comando da questão** (enunciado + alternativas), não por palavras soltas do texto-base, tema superficial ou posição na prova.

## Regras de ouro

1. **Linguagens:** interpretação de texto, literatura, gramática, semântica, figuras de linguagem, artes ou tecnologias da linguagem em português; reading comprehension **somente** quando a competência cobrada é claramente em inglês ou espanhol.
2. **Humanas:** processo histórico, espaço geográfico, argumento filosófico ou fenômeno social como objeto central da resposta.
3. **Natureza:** biologia, química ou física — processos, leis, fenômenos, cálculos científicos da disciplina.
4. **Exatas:** matemática pura — funções, geometria, álgebra, matrizes, probabilidade, aritmética/proporção **sem** fenômeno físico central.
5. Se confiança < 0.45 ou empate irresolvível → `areaId: "indefinido"`, `sinalizadorRevisao: true`.
6. **Não** escolha disciplina N1 nesta etapa — apenas a área macro.

## Anti-confusões (vestibular brasileiro)

| Sinal | Evitar | Preferir |
|-------|--------|----------|
| Comando em PT + texto-base literário/cultural em PT | ingles / natureza | linguagens |
| Texto com vocabulário científico usado como contexto de interpretação | natureza | linguagens |
| Comando em PT pede inferência sobre fala/expressão em inglês na tira | portugues | linguagens (disciplina EN vem depois) |
| Nicotina, fisiologia, ecologia como conteúdo cobrado | linguagens | natureza |
| Matriz, determinante, função y=f(x) | natureza / linguagens | exatas |
| Grandezas físicas, leis de Newton, circuitos como conteúdo | exatas / linguagens | natureza |
| Revolução, ditadura, fonte histórica | linguagens | humanas |
| Mapa, clima, relevo, território como eixo | história | humanas (geo) |
| `idiomaVariante` INGLES ou ESPANHOL | outras áreas | linguagens |

## Schema de saída

```json
{
  "rota": {
    "areaId": "linguagens|humanas|natureza|exatas|indefinido",
    "criterio": "conteudo_cobrado|competencia_linguistica|processo_cientifico|calculo_matematico|metadata|inferido|incerto",
    "confianca": 0.0,
    "justificativa": "1-2 frases",
    "sinalizadorRevisao": false
  }
}
```
