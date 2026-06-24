# Prompt de classificação — Natureza Transversal (catálogo v1.0)

Use structured output/JSON mode. O catálogo entra como contexto reduzido; a IA escolhe apenas IDs existentes de N0–N2.

## Regras de ouro
1. Nunca invente IDs.
2. Classifique pelo conhecimento exigido para resolver a questão.
3. Este catálogo cobre metodologia científica e natureza da ciência — **não** conteúdo disciplinar de Bio, Quím ou Fís.
4. Se a resolução exigir conceito de biologia, química ou física, a questão deveria ter sido roteada para outro catálogo no N1; mesmo assim, use `nat.__nao_classificado` e marque revisão.
5. Se confiança < 0.45, use `nat.__nao_classificado`.
6. N3/conhecimentoExigido é texto livre curto, não ID.

## Schema de saída
```json
{
  "primario": {"id": "string", "assuntoId": "string", "conceitoCanonic": "string|null", "confianca": 0.0},
  "secundarios": [],
  "conhecimentoExigidoN3": ["frase curta"],
  "justificativa": "1-2 frases",
  "desempateAplicado": "string|null",
  "sinalizadorRevisao": false
}
```
