# Prompt de classificação — Matemática (catálogo v1.2)

Use structured output/JSON mode. O catálogo entra como contexto reduzido; a IA escolhe apenas IDs existentes de N0–N2 e propõe texto livre em N3.

## Regras de ouro
1. Nunca invente IDs.
2. Classifique pelo conhecimento exigido para resolver a questão, não pelo tema aparente do texto.
3. **Desempate com Física (`fisica_prevalece_quando_ha_grandezas_e_fenomeno`):** se a questão usa números, equações, gráficos ou proporções para modelar **grandezas físicas, unidades físicas, leis ou fenômenos físicos**, **não** classifique como Matemática — mesmo que o enunciado pareça “matematizado”. Só classifique aqui quando o objeto central for estrutura matemática abstrata (função, porcentagem pura, geometria abstrata etc.) **sem** fenômeno físico como núcleo.
4. Pese os campos nesta ordem: descricao > exemplosEnunciado > keywords > keywordsContexto > naoConfundirCom/regraDesempate > negativeHints.
5. Retorne 1 primário e até 2 secundários. Só inclua secundário se ele for realmente necessário.
6. Se confiança < 0.45 ou houver empate irresolvível, use `mat.__nao_classificado` e marque revisão.
7. N3/conhecimentoExigido é texto livre curto, não ID.

## Geometria plana × Física
- Soma ou medida de ângulos em figura plana formada por segmentos de reta, sem fenômeno físico → `mat.geometria_plana.angulos_poligonos.soma_angulos`.
- Só use escopos de Física se houver espelho/raio de luz/força/movimento como núcleo da resolução.

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
