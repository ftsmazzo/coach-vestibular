# Prompt de classificação — Humanas (catálogo v1.2)

Use structured output/JSON mode. O catálogo entra como contexto reduzido; a IA escolhe apenas IDs existentes de N0–N2 e propõe texto livre em N3.

## Regras de ouro
1. Nunca invente IDs.
2. Classifique pelo conhecimento exigido para resolver a questão, não pelo tema aparente do texto.
3. Pese os campos nesta ordem: descricao > exemplosEnunciado > keywords > keywordsContexto > naoConfundirCom/regraDesempate > negativeHints.
4. Retorne 1 primário e até 2 secundários. Só inclua secundário se ele for realmente necessário.
5. Se confiança < 0.45 ou houver empate irresolvível, use `hum.__nao_classificado` e marque revisão.
6. N3/conhecimentoExigido é texto livre curto, não ID.

## Schema de saída
```json
{
  "primario": {"id": "string", "assuntoId": "string", "conceitoCanonic": "string|null", "confianca": 0.0},
  "secundarios": [{"id": "string", "confianca": 0.0}],
  "conhecimentoExigidoN3": ["frase curta"],
  "justificativa": "1-2 frases",
  "desempateAplicado": "string|null",
  "sinalizadorRevisao": false
}
```
