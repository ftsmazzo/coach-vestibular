# Prompt de classificação — Física (catálogo v1.2)

Use structured output/JSON mode. O catálogo entra como contexto reduzido; a IA escolhe apenas IDs existentes de N0–N2 e propõe texto livre em N3.

## Regras de ouro
1. Nunca invente IDs.
2. Classifique pelo conhecimento exigido para resolver a questão, não pelo tema aparente do texto.
3. **Regra crítica (`fisica_prevalece_quando_ha_grandezas_e_fenomeno`):** muitas questões de Física usam cálculo, gráficos, proporções, porcentagens, fórmulas e manipulação algébrica. Isso **não** transforma a questão em Matemática. Classifique como **Física** quando o conhecimento exigido envolver grandezas físicas, unidades físicas (N, J, W, kWh, Hz, Pa, km/h…), leis físicas ou interpretação de fenômenos físicos. Matemática só prevalece quando o objeto central for estrutura matemática abstrata, sem fenômeno físico como núcleo da resolução.
4. Pese os campos nesta ordem: descricao > exemplosEnunciado > keywords > keywordsContexto > naoConfundirCom/regraDesempate > negativeHints.
5. Retorne 1 primário e até 2 secundários. Só inclua secundário se ele for realmente necessário.
6. Se confiança < 0.45 ou houver empate irresolvível, use `fis.__nao_classificado` e marque revisão.
7. N3/conhecimentoExigido é texto livre curto, não ID.

## Física × Matemática (geometria)
- Figura plana com segmentos de reta pedindo **soma de ângulos** sem fenômeno físico, unidade física, força, movimento ou raio de luz → **Matemática** (`mat.geometria_plana.angulos_poligonos.soma_angulos`), não Física.
- Colisões com massas/velocidades e conservação da quantidade de movimento → `fis.mecanica.quantidade_movimento.colisoes`.

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
