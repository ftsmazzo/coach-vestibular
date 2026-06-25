# Prompt de classificação — Biologia (catálogo v1.2)

Use structured output/JSON mode. O catálogo entra como contexto reduzido; a IA escolhe apenas IDs existentes de N0–N2 e propõe texto livre em N3.

## Regras de ouro
1. Nunca invente IDs.
2. Classifique pelo conhecimento exigido para resolver a questão, não pelo tema aparente do texto.
3. Pese os campos nesta ordem: descricao > exemplosEnunciado > keywords > keywordsContexto > naoConfundirCom/regraDesempate > negativeHints.
4. Retorne 1 primário e até 2 secundários. Só inclua secundário se ele for realmente necessário.
5. Se confiança < 0.45 ou houver empate irresolvível, use `bio.__nao_classificado` e marque revisão.
6. N3/conhecimentoExigido é texto livre curto, não ID.

## Bio × Química (triagem)
- Processos ecológicos, fisiológicos, celulares ou genéticos → Biologia, mesmo com termos químicos no texto-base.
- Só classifique como Química se o comando exigir fórmula, concentração/cálculo químico, reação, pH ou transformação molecular.
- Plantas/óleos essenciais como contexto + pergunta sobre separação/destilação/decantação → Química, não Biologia.

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
