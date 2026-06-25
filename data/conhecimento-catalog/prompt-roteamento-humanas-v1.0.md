# Prompt de roteamento — Humanas (v1.0)

Use structured output/JSON mode. Esta etapa **só decide a disciplina** antes da classificação N2 no catálogo correspondente.

**Disciplinas:** `historia` | `geografia` | `filosofia` | `sociologia` | `indefinido`

**Catálogos:** `hist.*` | `geo.*` | `fil.*` | `soc.*`

## Regras de ouro
1. Classifique pelo **conhecimento exigido para resolver**, não pelo tema superficial, personagem citado ou palavra solta no texto-base.
2. `areaBloco` "Ciências Humanas" é hint fraco — não substitui análise do enunciado + alternativas.
3. **História:** processo temporal, causas/consequências, fontes, memória, períodos, atores políticos no tempo, evento cronológico.
4. **Geografia:** espaço, território, escala, mapa, clima, relevo, urbanização, recursos naturais, população como eixo espacial central.
5. **Filosofia:** conceito, autor, argumento ou problema filosófico (ética, epistemologia, política filosófica, existência, linguagem).
6. **Sociologia:** fenômeno social empírico — instituições, desigualdade, movimentos, cultura, trabalho, classes, Estado, identidade, globalização social.
7. Se confiança < 0.45 ou empate irresolvível entre duas disciplinas → `disciplinaId: "indefinido"`, `sinalizadorRevisao: true`.
8. **Não** escolha escopo N2 nesta etapa — apenas roteamento disciplinar (passo 2 usa o prompt da disciplina).

## Desempates cruzados (resumo)
| Sinal no texto | Evitar | Preferir |
|----------------|--------|----------|
| mapa, escala, bioma, clima, relevo | história | geografia |
| Revolução, ditadura, independência, fonte histórica | geografia / sociologia | história |
| Kant, Platão, imperativo categórico, epistemologia | história / sociologia | filosofia |
| classes sociais, movimento social, desigualdade estrutural | história / filosofia | sociologia |
| território como cenário de evento histórico | geografia | história |
| gênero como construção social, família, identidade | biologia / filosofia | sociologia |
| interpretação gramatical ou figura de linguagem isolada | qualquer humanas | **não rotear** (fora do escopo) |
| Ensaio/canção/meme com comando sobre sociedade contemporânea, exclusão, produtivismo | portugues / história | sociologia |
| Esgoto/eutrofização/qualidade da água sem cálculo químico central | química | geografia |

## Schema de saída (só roteamento)
```json
{
  "rota": {
    "disciplinaId": "historia|geografia|filosofia|sociologia|indefinido",
    "catalogoMateriaId": "historia|geografia|filosofia|sociologia|null",
    "criterio": "conteudo_cobrado|processo_historico|espaco_territorio|pensamento_etico|estrutura_social|metadata|inferido|incerto",
    "confianca": 0.0,
    "justificativa": "1-2 frases"
  },
  "sinalizadorRevisao": false
}
```
