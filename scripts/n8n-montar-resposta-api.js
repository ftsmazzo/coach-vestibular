/**
 * n8n — nó Code «Montar Resposta API»
 * Entrada: saída do nó «Cria Prova» (itens por questão ou objeto de erro).
 * Saída: JSON único para Respond to Webhook.
 */
const items = $input.all();
const first = items[0]?.json || {};

const body = $('Webhook Extracao')?.first()?.json?.body || {};
const provaId = body.provaId ?? body.prova_id ?? null;
const totalEsperado =
  body.totalQuestoes != null
    ? Number(body.totalQuestoes)
    : body.total_questoes != null
      ? Number(body.total_questoes)
      : null;

function metricasDeQuestoes(questoes) {
  const validas = questoes.filter((q) => q.valido !== false && q.numero > 0);
  return {
    total_itens: items.length,
    total_validas: validas.length,
    numeros_unicos: new Set(validas.map((q) => q.numero)).size,
    total_esperado: totalEsperado,
  };
}

if (first.erro || first.precisa_sanitizacao) {
  return [
    {
      json: {
        status: 'fallback_pipeline',
        fonte: 'n8n',
        provaId,
        motivo: first.tipo_erro || 'COBERTURA_INCOMPLETA',
        metricas: {
          total_itens: first.total_questoes ?? 0,
          total_validas: first.total_validas ?? 0,
          numeros_unicos: first.numeros_unicos_validos ?? 0,
          total_esperado: first.total_esperado ?? totalEsperado,
        },
        mensagem:
          first.mensagem ||
          'Extração incompleta na 1ª passagem — o app deve usar o Pipeline interno.',
      },
    },
  ];
}

const questoes = items
  .map((i) => i.json)
  .filter((q) => q && q.numero > 0 && q.valido !== false)
  .map((q, idx) => ({
    indice_global: idx + 1,
    numero: q.numero,
    secao: q.secao ?? null,
    opcao_lingua_estrangeira: q.opcao_lingua_estrangeira ?? null,
    enunciado: q.enunciado ?? null,
    alternativas: q.alternativas ?? null,
    texto_base_anterior: q.texto_base_anterior ?? null,
    valido: q.valido !== false,
  }));

return [
  {
    json: {
      status: 'ok',
      fonte: 'n8n',
      provaId,
      metricas: metricasDeQuestoes(questoes),
      questoes,
    },
  },
];
