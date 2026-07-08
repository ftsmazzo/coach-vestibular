/**
 * Etapa 4D — síntese narrativa do Diagnóstico Inicial.
 * Transforma baseline numérico em leitura pedagógica (não soma simples de erros).
 */
import type { StructuredAnamneseProfile } from "@/lib/anamnese-types";
import type { EscopoScore } from "@/lib/diagnosis-escopo";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import type {
  BaselineEscopoJornada,
  BaselineJornada,
} from "@/lib/jornada-diagnostico-inicial";
import {
  avaliarQualidadeFocoInicial,
  inputEscopoFromBaseline,
  motivoPrioridadeEnriquecido,
  type InputEscopoFoco,
} from "@/lib/jornada-foco-inicial";
import { getMateriaLabel } from "@/lib/taxonomy";

export const MIN_ERROS_ESCOPO_CRITICO = 2;
export const MAX_ESCOPOS_CRITICOS = 5;
export const MAX_PRIORIDADES_INICIAIS = 5;
export const MAX_FRAGILIDADES = 5;

const ROTULO_TIPO_ERRO: Record<string, string> = {
  CONCEITO_TEORICO: "lacuna conceitual",
  INTERPRETACAO_ENUNCIADO: "dificuldade de interpretar o enunciado",
  DUVIDA_CRUCIAL: "dúvida em ponto decisivo da resolução",
  CHUTE_TOTAL: "resposta sem modelo claro (chute ou insegurança)",
  FALTA_TEMPO: "pressão de tempo",
  CALCULO_BOBEIRA: "erro de execução após montar o modelo",
};

const INTERPRETACAO_TIPO_ERRO: Record<string, string> = {
  CONCEITO_TEORICO:
    "Os erros sugerem que o conteúdo ainda não está disponível para uso — não é só descuido na prova.",
  INTERPRETACAO_ENUNCIADO:
    "Parte da teoria pode estar presente, mas o enunciado não é traduzido em estratégia de resolução.",
  DUVIDA_CRUCIAL:
    "A dúvida aparece em momentos decisivos da questão — vale isolar o passo que trava a resolução.",
  CHUTE_TOTAL:
    "Há sinais de resposta sem critério claro; convém reconstruir o raciocínio antes de treinar volume.",
  FALTA_TEMPO:
    "O tempo parece interferir na execução; ritmo e priorização entram na leitura inicial.",
  CALCULO_BOBEIRA:
    "O modelo pode estar encaminhado, mas a execução ainda custa — refazer o passo operacional ajuda.",
};

export function rotularTipoErro(tipo: string): string {
  return ROTULO_TIPO_ERRO[tipo] ?? tipo.replace(/_/g, " ").toLowerCase();
}

export function dominanteTipoErro(tiposErro: Record<string, number>): string | null {
  const sorted = Object.entries(tiposErro).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[1] > 0 ? sorted[0][0] : null;
}

export function truncarTextoN3(texto: string, max = 72): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function escopoElegivelParaDiagnosticoCritico(linha: BaselineEscopoJornada): boolean {
  if (linha.estadoInicial === "MONITORAR" || linha.estadoInicial === "SINAL_INICIAL") {
    return false;
  }
  if (linha.erros < MIN_ERROS_ESCOPO_CRITICO) return false;
  if (linha.erros === 2 && linha.provasComErro < 2 && linha.total < 4) return false;
  return true;
}

export function montarEvidenciasEscopoRicas(
  linha: BaselineEscopoJornada,
  escopoLabel: string,
  escopoScore?: EscopoScore
): string[] {
  const evidencias: string[] = [];
  const tipoDom = dominanteTipoErro(linha.tiposErro);

  if (linha.erros >= 3 && linha.provasComErro >= 2) {
    evidencias.push(
      `${linha.erros} erros em ${linha.total} questões de ${escopoLabel}, repetindo em ${linha.provasComErro} provas`
    );
  } else if (linha.pctErro >= 55 && linha.total >= 4) {
    evidencias.push(
      `${linha.pctErro}% de erro em ${escopoLabel} (${linha.erros} de ${linha.total} questões)`
    );
  } else if (linha.erros >= 2) {
    evidencias.push(`${linha.erros} erros analisáveis em ${linha.total} questão(ões) de ${escopoLabel}`);
  }

  if (tipoDom && linha.tiposErro[tipoDom]! >= 2) {
    evidencias.push(
      `Padrão dominante: ${rotularTipoErro(tipoDom)} (${linha.tiposErro[tipoDom]} ocorrências)`
    );
  } else if (tipoDom) {
    evidencias.push(`Tipo de erro mais frequente: ${rotularTipoErro(tipoDom)}`);
  }

  const n3 = linha.conhecimentosExigidos.filter(Boolean).slice(0, 2);
  if (n3.length === 1) {
    evidencias.push(`Conhecimento que reaparece: “${truncarTextoN3(n3[0]!)}”`);
  } else if (n3.length >= 2) {
    evidencias.push(
      `Conhecimentos semelhantes nos erros: “${truncarTextoN3(n3[0]!)}” e “${truncarTextoN3(n3[1]!)}”`
    );
  }

  if (linha.observacoesAluno[0]) {
    evidencias.push(`Você registrou: “${truncarTextoN3(linha.observacoesAluno[0], 90)}”`);
  }

  const resumoMeta = escopoScore?.metadadosCognitivosResumo?.resumoTexto;
  if (resumoMeta && resumoMeta !== "Sem metadados detalhados") {
    evidencias.push(`Metadados cognitivos: ${truncarTextoN3(resumoMeta, 100)}`);
  }

  return evidencias.slice(0, 4);
}

export function motivoDiagnosticoEscopo(
  linha: BaselineEscopoJornada,
  escopoLabel: string,
  qualidade: ReturnType<typeof avaliarQualidadeFocoInicial>,
  escopoScore?: EscopoScore
): string {
  const tipoDom = dominanteTipoErro(linha.tiposErro);
  const partes: string[] = [];

  if (linha.erros >= 3 && linha.provasComErro >= 2) {
    partes.push(
      `${escopoLabel} concentra ${linha.erros} erros em ${linha.total} questões e reaparece em ${linha.provasComErro} provas`
    );
  } else if (linha.pctErro >= 50 && linha.total >= 4) {
    partes.push(
      `Em ${escopoLabel}, ${linha.pctErro}% das ${linha.total} questões da amostra terminaram em erro`
    );
  } else {
    partes.push(motivoPrioridadeEnriquecido(linha, escopoLabel, qualidade).replace(/\.$/, ""));
  }

  if (tipoDom && INTERPRETACAO_TIPO_ERRO[tipoDom]) {
    partes.push(INTERPRETACAO_TIPO_ERRO[tipoDom]!);
  }

  const n3 = linha.conhecimentosExigidos[0];
  if (n3 && linha.conhecimentosExigidos.length >= 2) {
    partes.push(
      `Os erros convergem em conhecimentos parecidos — por exemplo: “${truncarTextoN3(n3)}”`
    );
  }

  if (escopoScore && escopoScore.recorrencia >= 2 && !partes.some((p) => p.includes("reaparece"))) {
    partes.push("O escopo não parece um evento isolado na amostra inicial");
  }

  return `${partes.join(". ")}.`;
}

export type ForcaDiagnostico = {
  titulo: string;
  descricao: string;
  evidencias: string[];
  escoposAssociados: string[];
};

export function montarForcasDiagnostico(
  porEscopo: BaselineEscopoJornada[],
  porN1: Array<{ n1: string; total: number; acertos: number; pctAcerto: number }>
): ForcaDiagnostico[] {
  const escoposIndex = indexGlobalEscopos();
  const forcas: ForcaDiagnostico[] = [];

  const forcasEscopo = porEscopo
    .filter((e) => e.total >= 5 && e.pctErro <= 35 && e.acertos >= 4)
    .sort((a, b) => b.acertos - a.acertos || a.pctErro - b.pctErro)
    .slice(0, 3);

  for (const e of forcasEscopo) {
    const label = escoposIndex.get(e.escopoId)?.escopoLabel ?? e.escopoId;
    forcas.push({
      titulo: label,
      descricao: `Estabilidade em ${label}: ${100 - e.pctErro}% de acerto em ${e.total} questões classificadas nas provas consideradas.`,
      evidencias: [
        `${e.acertos} acertos em ${e.total} questões`,
        ...(e.provasComErro === 0 ? ["Sem erros registrados neste escopo na amostra"] : []),
      ],
      escoposAssociados: [e.escopoId],
    });
  }

  const n1JaCobertos = new Set(forcas.map((f) => f.escoposAssociados[0]?.split(".")[0]));

  const forcasN1 = porN1
    .filter((n) => n.total >= 8 && n.pctAcerto >= 62 && !n1JaCobertos.has(n.n1))
    .sort((a, b) => b.pctAcerto - a.pctAcerto)
    .slice(0, Math.max(0, 3 - forcas.length));

  for (const n of forcasN1) {
    const label = getMateriaLabel(n.n1) || n.n1;
    forcas.push({
      titulo: label,
      descricao: `${n.pctAcerto}% de acerto em ${n.total} questões de ${label} — desempenho mais sólido na amostra inicial.`,
      evidencias: [`${n.acertos} acertos em ${n.total} questões`],
      escoposAssociados: porEscopo
        .filter((e) => e.escopoId.startsWith(n.n1) && e.pctErro < 40)
        .slice(0, 3)
        .map((e) => e.escopoId),
    });
  }

  return forcas.slice(0, 3);
}

export type EscopoCriticoDiagnostico = {
  escopoId: string;
  dominioId?: string | null;
  estado: "CRITICO" | "FRAGILIDADE" | "MONITORAR";
  motivo: string;
  evidencias: string[];
  n3Recorrentes: string[];
  tiposErroRelevantes: string[];
};

export function montarEscoposCriticosDiagnostico(
  porEscopo: BaselineEscopoJornada[],
  escopoScores: EscopoScore[],
  inputsAlternativas: InputEscopoFoco[]
): EscopoCriticoDiagnostico[] {
  const escoposIndex = indexGlobalEscopos();
  const scoreMap = new Map(escopoScores.map((s) => [s.escopoId, s]));

  return porEscopo
    .filter(escopoElegivelParaDiagnosticoCritico)
    .sort((a, b) => b.pesoDiagnostico - a.pesoDiagnostico)
    .slice(0, MAX_ESCOPOS_CRITICOS)
    .map((e) => {
      const label = escoposIndex.get(e.escopoId)?.escopoLabel ?? e.escopoId;
      const escopoScore = scoreMap.get(e.escopoId);
      const qualidade = avaliarQualidadeFocoInicial(
        inputEscopoFromBaseline(e, label),
        inputsAlternativas
      );
      const tipos = Object.keys(e.tiposErro);
      return {
        escopoId: e.escopoId,
        dominioId: e.dominioId,
        estado:
          e.estadoInicial === "CRITICO"
            ? ("CRITICO" as const)
            : e.estadoInicial === "FRAGILIDADE"
              ? ("FRAGILIDADE" as const)
              : ("MONITORAR" as const),
        motivo: motivoDiagnosticoEscopo(e, label, qualidade, escopoScore),
        evidencias: montarEvidenciasEscopoRicas(e, label, escopoScore),
        n3Recorrentes: e.conhecimentosExigidos.slice(0, 4),
        tiposErroRelevantes: tipos,
      };
    });
}

export type PrioridadeDiagnostico = {
  ordem: number;
  escopoId?: string;
  n1?: string;
  titulo: string;
  motivo: string;
  tipoPrioridade: "CONTEUDO" | "COGNITIVA" | "MISTA" | "ROTINA";
};

const TIPOS_ERRO_COGNITIVOS = new Set([
  "INTERPRETACAO_ENUNCIADO",
  "DUVIDA_CRUCIAL",
  "CHUTE_TOTAL",
  "FALTA_TEMPO",
]);

export function montarPrioridadesDiagnostico(
  porEscopo: BaselineEscopoJornada[],
  escopoScores: EscopoScore[],
  padroesCognitivos: BaselineJornada["padroesCognitivos"],
  moduladoresAnamnese: string[],
  inputsAlternativas: InputEscopoFoco[]
): PrioridadeDiagnostico[] {
  const escoposIndex = indexGlobalEscopos();
  const scoreMap = new Map(escopoScores.map((s) => [s.escopoId, s]));

  const candidatos = porEscopo
    .filter((e) => e.erros > 0 && e.estadoInicial !== "MONITORAR")
    .map((e) => {
      const label = escoposIndex.get(e.escopoId)?.escopoLabel ?? e.escopoId;
      const input = inputEscopoFromBaseline(e, label);
      const qualidade = avaliarQualidadeFocoInicial(input, inputsAlternativas);
      const escopoScore = scoreMap.get(e.escopoId);
      const scoreCombinado =
        e.pesoDiagnostico * 0.55 +
        qualidade.scoreQualidade * 0.35 +
        (escopoScore?.prioridadeScore ?? 0) * 0.1;
      return { e, label, qualidade, escopoScore, scoreCombinado };
    })
    .filter((c) => c.qualidade.aprovado || c.e.pesoDiagnostico >= 14)
    .sort((a, b) => b.scoreCombinado - a.scoreCombinado);

  const prioridades: PrioridadeDiagnostico[] = candidatos.slice(0, MAX_PRIORIDADES_INICIAIS).map((c, i) => {
    const tipoErroDom = dominanteTipoErro(c.e.tiposErro);
    const tipoPrioridade: PrioridadeDiagnostico["tipoPrioridade"] =
      tipoErroDom && TIPOS_ERRO_COGNITIVOS.has(tipoErroDom)
        ? moduladoresAnamnese.length > 0 && i === 0
          ? "MISTA"
          : "COGNITIVA"
        : moduladoresAnamnese.length > 0 && i === 0
          ? "MISTA"
          : "CONTEUDO";

    return {
      ordem: i + 1,
      escopoId: c.e.escopoId,
      n1: c.e.escopoId.split(".")[0],
      titulo: c.label,
      motivo: motivoDiagnosticoEscopo(c.e, c.label, c.qualidade, c.escopoScore),
      tipoPrioridade,
    };
  });

  if (prioridades.length === 0 && escopoScores[0]) {
    const top = escopoScores[0];
    prioridades.push({
      ordem: 1,
      escopoId: top.escopoId,
      n1: top.materiaId,
      titulo: top.escopoLabel,
      motivo: `${top.escopoLabel} concentrou ${top.erros} erro(s) com maior pressão na amostra — ainda com evidência limitada para afirmar consolidação.`,
      tipoPrioridade: "CONTEUDO",
    });
  }

  const padraoForte = padroesCognitivos.find((p) => p.ocorrencias >= 4);
  if (
    padraoForte &&
    prioridades.length > 0 &&
    prioridades.length < MAX_PRIORIDADES_INICIAIS &&
    !prioridades.some((p) => p.tipoPrioridade === "COGNITIVA")
  ) {
    prioridades.push({
      ordem: prioridades.length + 1,
      titulo: rotularTipoErro(padraoForte.tipo),
      motivo: `${INTERPRETACAO_TIPO_ERRO[padraoForte.tipo] ?? padraoForte.interpretacao} (${padraoForte.ocorrencias} ocorrências em ${padraoForte.escoposAssociados.length} escopos).`,
      tipoPrioridade: "COGNITIVA",
    });
  }

  return prioridades.slice(0, MAX_PRIORIDADES_INICIAIS);
}

export function montarPadroesCognitivosDiagnostico(
  padroes: BaselineJornada["padroesCognitivos"]
): Array<{ titulo: string; descricao: string; evidencias: string[] }> {
  return padroes
    .filter((p) => p.ocorrencias >= 2)
    .slice(0, 5)
    .map((p) => ({
      titulo: rotularTipoErro(p.tipo),
      descricao:
        INTERPRETACAO_TIPO_ERRO[p.tipo] ??
        p.interpretacao ??
        "Padrão de erro observado nas provas consideradas.",
      evidencias: [
        `${p.ocorrencias} ocorrências`,
        `Presente em ${p.escoposAssociados.length} escopo(s) distintos`,
      ],
    }));
}

export function cruzarAnamneseComEvidencias(
  profile: StructuredAnamneseProfile | null | undefined,
  porEscopo: BaselineEscopoJornada[],
  porN1: Array<{ n1: string; total: number; erros: number; pctAcerto: number }>
): { moduladores: string[]; limites: string[]; confirmacoes: string[] } {
  const moduladores: string[] = [];
  const limites: string[] = [];
  const confirmacoes: string[] = [];
  const escoposIndex = indexGlobalEscopos();

  if (profile?.routine?.consistencyLevel === "BAIXA") {
    moduladores.push(
      "Rotina de estudo com consistência baixa — a Jornada começa com poucas prioridades para não sobrecarregar."
    );
  }
  if (profile?.examBehavior?.anxietyOrBlanking) {
    moduladores.push(
      "Ansiedade ou branco em prova relatados na anamnese — ritmo e volume da primeira semana serão moderados."
    );
  }
  if (profile?.examBehavior?.fatigueInLongExams) {
    moduladores.push("Fadiga em provas longas — distribuição de carga importa desde o início.");
  }

  for (const fraca of profile?.academicSelfPerception?.perceivedWeakSubjects ?? []) {
    const fracaNorm = fraca.toLowerCase();
    const confirmada = porN1.some((n) => {
      const label = (getMateriaLabel(n.n1) || n.n1).toLowerCase();
      return (
        (label.includes(fracaNorm) || fracaNorm.includes(label)) &&
        n.erros >= 3 &&
        n.pctAcerto < 55
      );
    });
    const fragilEscopo = porEscopo.find((e) => {
      const label = (escoposIndex.get(e.escopoId)?.escopoLabel ?? e.escopoId).toLowerCase();
      return label.includes(fracaNorm) && e.erros >= 2;
    });

    if (confirmada || fragilEscopo) {
      confirmacoes.push(
        `${fraca} aparece como fragilidade tanto na anamnese quanto nas provas consideradas.`
      );
    } else {
      limites.push(
        `${fraca} foi citada como dificuldade na anamnese, mas ainda não há evidência forte nas provas — não vira prioridade automática.`
      );
    }
  }

  if (profile?.academicSelfPerception?.perceivedWeakSubjects?.length) {
    limites.push(
      "Matérias percebidas como fracas só viram prioridade quando confirmadas por erros classificados nas provas."
    );
  }

  return { moduladores, limites, confirmacoes };
}

export function montarResumoExecutivoDiagnostico(opts: {
  provas: number;
  questoes: number;
  pctAcerto: number;
  escoposCriticos: EscopoCriticoDiagnostico[];
  prioridades: PrioridadeDiagnostico[];
  forcas: ForcaDiagnostico[];
  padraoCognitivoTop?: { titulo: string; ocorrencias: number };
  moduladoresAnamnese: string[];
  confirmacoesAnamnese: string[];
}): string {
  const partes: string[] = [];

  partes.push(
    `Com base em ${opts.provas} prova(s) e ${opts.questoes} questões válidas (${opts.pctAcerto}% de acerto na amostra)`
  );

  if (opts.prioridades[0]) {
    partes.push(`a leitura inicial aponta ${opts.prioridades[0].titulo} como eixo mais urgente`);
    if (opts.prioridades[1]) {
      partes.push(`seguido de ${opts.prioridades[1].titulo}`);
    }
  } else if (opts.escoposCriticos[0]) {
    const idx = indexGlobalEscopos();
    const label =
      idx.get(opts.escoposCriticos[0].escopoId)?.escopoLabel ?? opts.escoposCriticos[0].escopoId;
    partes.push(`a leitura inicial destaca atenção em ${label}`);
  }

  if (opts.padraoCognitivoTop && opts.padraoCognitivoTop.ocorrencias >= 3) {
    partes.push(
      `com padrão transversal de ${opts.padraoCognitivoTop.titulo} (${opts.padraoCognitivoTop.ocorrencias} ocorrências)`
    );
  }

  if (opts.forcas[0]) {
    partes.push(`enquanto ${opts.forcas[0].titulo} aparece mais estável na amostra`);
  }

  if (opts.confirmacoesAnamnese[0]) {
    partes.push(opts.confirmacoesAnamnese[0]!.replace(/\.$/, ""));
  } else if (opts.moduladoresAnamnese[0]) {
    partes.push(
      "a anamnese sugere moderar volume e ritmo nas primeiras intervenções"
    );
  }

  const texto = partes.join(", ") + ".";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
