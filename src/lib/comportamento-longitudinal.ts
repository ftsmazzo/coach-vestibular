/**
 * Memória de comportamento — episódio vs recorrência, tendência, contexto de prova.
 */
import type { EventoErroPedagogico } from "@/lib/diagnostic-motor";
import type { PedagogicalClusterId } from "@/lib/pedagogical-clusters";

export type TendenciaComportamento = "inicio" | "crescente" | "estavel" | "diminuindo";
export type RecorrenciaComportamento = "episodico" | "recorrente" | "forte";

export type ComportamentoLongitudinal = {
  provasComErro: number;
  totalProvasJanela: number;
  tendencia: TendenciaComportamento;
  recorrencia: RecorrenciaComportamento;
  emProvasLongas: boolean;
  sobPressaoTempo: boolean;
};

const LIMIAR_PROVA_LONGA = 12;

export function calcularComportamentoCluster(
  eventos: EventoErroPedagogico[],
  clusterId: PedagogicalClusterId,
  totalExamesJanela: number
): ComportamentoLongitudinal {
  const doCluster = eventos.filter((e) => e.clusterId === clusterId);
  const vazio: ComportamentoLongitudinal = {
    provasComErro: 0,
    totalProvasJanela: totalExamesJanela,
    tendencia: "inicio",
    recorrencia: "episodico",
    emProvasLongas: false,
    sobPressaoTempo: false,
  };
  if (doCluster.length === 0) return vazio;

  const errosTotaisPorProva = new Map<string, number>();
  for (const e of eventos) {
    errosTotaisPorProva.set(e.examId, (errosTotaisPorProva.get(e.examId) ?? 0) + 1);
  }

  const porProva = new Map<string, { count: number; data: Date }>();
  for (const e of doCluster) {
    const cur = porProva.get(e.examId);
    porProva.set(e.examId, {
      count: (cur?.count ?? 0) + 1,
      data: e.examData,
    });
  }

  const provas = [...porProva.entries()].sort(
    (a, b) => a[1].data.getTime() - b[1].data.getTime()
  );
  const provasComErro = provas.length;

  let errosPrimeira = 0;
  let errosSegunda = 0;
  if (provas.length >= 2) {
    const mid = Math.ceil(provas.length / 2);
    provas.forEach(([_, v], i) => {
      if (i < mid) errosPrimeira += v.count;
      else errosSegunda += v.count;
    });
  }

  let tendencia: TendenciaComportamento = "inicio";
  if (provas.length >= 2) {
    if (errosSegunda > errosPrimeira * 1.15) tendencia = "crescente";
    else if (errosSegunda < errosPrimeira * 0.85) tendencia = "diminuindo";
    else tendencia = "estavel";
  }

  const ratio = provasComErro / Math.max(1, totalExamesJanela);
  let recorrencia: RecorrenciaComportamento = "episodico";
  if (provasComErro >= 3 || ratio >= 0.5) recorrencia = "forte";
  else if (provasComErro >= 2 || ratio >= 0.25) recorrencia = "recorrente";

  let errosEmLongas = 0;
  for (const [examId, { count }] of porProva) {
    if ((errosTotaisPorProva.get(examId) ?? 0) >= LIMIAR_PROVA_LONGA) {
      errosEmLongas += count;
    }
  }
  const emProvasLongas = errosEmLongas / doCluster.length >= 0.45;

  const causasTempo = doCluster.filter((e) => e.tipoErro === "FALTA_TEMPO").length;
  const sobPressaoTempo = causasTempo / doCluster.length >= 0.25;

  return {
    provasComErro,
    totalProvasJanela: totalExamesJanela,
    tendencia,
    recorrencia,
    emProvasLongas,
    sobPressaoTempo,
  };
}

export function fraseContextoLongitudinal(
  c: ComportamentoLongitudinal,
  materia: string
): string {
  const partes: string[] = [];

  if (c.recorrencia === "episodico") {
    partes.push("Ainda é cedo para cravar — apareceu em poucos registros, mas já vale treinar de propósito.");
  } else if (c.recorrencia === "recorrente") {
    partes.push(
      `Não foi um dia ruim só: isso voltou em ${c.provasComErro} provas da sua jornada, sobretudo em ${materia}.`
    );
  } else {
    partes.push(
      `É um dos padrões mais consistentes que acompanhamos: ${c.provasComErro} provas com esse tipo de trava, em especial em ${materia}.`
    );
  }

  if (c.tendencia === "crescente") {
    partes.push("Nas provas mais recentes, isso ficou mais frequente — por isso entrou como prioridade agora.");
  } else if (c.tendencia === "diminuindo") {
    partes.push(
      "Nas provas recentes já aparece um pouco menos — sinal de que, com treino focado, a tendência pode continuar melhorando."
    );
  } else if (c.tendencia === "estavel" && c.recorrencia !== "episodico") {
    partes.push("O ritmo se manteve parecido ao longo dos registros — dá para atacar com método, não no improviso.");
  }

  if (c.emProvasLongas) {
    partes.push(
      "Chama atenção em provas longas, quando você precisa segurar atenção e juntar várias etapas mentais seguidas."
    );
  }
  if (c.sobPressaoTempo) {
    partes.push("O tempo apertando também entra na história — não é só conteúdo, é gestão da prova.");
  }

  return partes.join(" ");
}
