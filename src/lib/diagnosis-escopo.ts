import type { ErrorType } from "@/generated/prisma/client";
import type { AttemptInput } from "@/lib/diagnosis";
import {
  idFallbackNaoClassificado,
  indexGlobalEscopos,
} from "@/lib/conhecimento-catalog/load";
import { getMateriaLabel } from "@/lib/taxonomy";
import {
  agregarMetadadosCognitivos,
  type MetadadosCognitivosResumo,
} from "@/lib/metadados-cognitivos";

const CONFIANCA_MINIMA = 0.55;
const TIPOS_ERRO_CRITICOS = new Set<string>([
  "CONCEITO_TEORICO",
  "INTERPRETACAO_ENUNCIADO",
  "DUVIDA_CRUCIAL",
]);

export interface AnamneseContext {
  resumo?: string | null;
  padroesDeclarados?: string[];
  materiasFracas?: string[];
  materiasFortes?: string[];
  fadigaProvaLonga?: boolean;
  ansiedade?: boolean;
  maturidadeMetacognitiva?: string | null;
  confianca?: string | null;
  bloqueio?: string | null;
}

export interface EscopoScore {
  materiaId: string;
  materiaLabel: string;
  dominioId: string;
  escopoId: string;
  escopoLabel: string;
  conhecimentoExigidoSamples: string[];
  conceitosCanonicos: string[];
  total: number;
  erros: number;
  acertos: number;
  taxaAcerto: number;
  vulnerabilidade: number;
  recorrencia: number;
  prioridadeScore: number;
  numerosErrados: number[];
  tipoErroDominante?: ErrorType | null;
  metadadosCognitivosResumo?: MetadadosCognitivosResumo;
  classificacaoConfiancaMedia?: number;
}

export type EstrategiaIntervencao =
  | "revisao_conceitual"
  | "modelagem_guiada"
  | "engenharia_reversa"
  | "treino_cronometrado"
  | "comparacao_de_conceitos"
  | "refazer_erro"
  | "mini_simulado_dirigido"
  | "metacognicao";

export interface FocoPedagogico {
  focoId: string;
  materiaId: string;
  materiaLabel: string;
  dominioId: string;
  escopoId: string;
  escopoLabel: string;
  conhecimentoExigido: string[];
  conceitosCanonicos: string[];
  numerosErrados: number[];
  totalErros: number;
  taxaAcerto: number;
  prioridade: "alta" | "media" | "manutencao";
  tipoErroDominante?: ErrorType | null;
  metadadosCognitivosResumo?: MetadadosCognitivosResumo;
  hipoteseCausa: string;
  objetivoDaSemana: string;
  estrategiaRecomendada: EstrategiaIntervencao;
}

function escopoEhFallback(escopoId: string, materiaId: string): boolean {
  if (escopoId.includes("__nao_classificado")) return true;
  if (escopoId === idFallbackNaoClassificado(materiaId)) return true;
  const entry = indexGlobalEscopos().get(escopoId);
  return entry?.ehFallback === true;
}

function impactoMateria(materiaId: string): number {
  const pesos: Record<string, number> = {
    matematica: 1.5,
    biologia: 1.2,
    quimica: 1.2,
    fisica: 1.2,
    portugues: 1.3,
    historia: 1.0,
    geografia: 1.0,
  };
  return pesos[materiaId] ?? 1.0;
}

function tipoErroCriticoScore(tipo: ErrorType | null | undefined): number {
  if (!tipo) return 0;
  return TIPOS_ERRO_CRITICOS.has(tipo) ? 1 : 0.3;
}

function anamneseConfirmaEscopo(
  escopo: EscopoScore,
  anamnese?: AnamneseContext
): number {
  if (!anamnese) return 0;
  let score = 0;
  const materiaLabel = escopo.materiaLabel.toLowerCase();
  const escopoLabel = escopo.escopoLabel.toLowerCase();

  for (const fraca of anamnese.materiasFracas ?? []) {
    if (
      materiaLabel.includes(fraca.toLowerCase()) ||
      fraca.toLowerCase().includes(materiaLabel)
    ) {
      score += 0.8;
      break;
    }
  }

  for (const padrao of anamnese.padroesDeclarados ?? []) {
    const p = padrao.toLowerCase();
    if (p.includes(escopoLabel) || escopoLabel.includes(p)) score += 0.5;
  }

  if (anamnese.bloqueio) {
    const b = anamnese.bloqueio.toLowerCase();
    if (b.includes(materiaLabel) || b.includes(escopoLabel)) score += 0.4;
  }

  return Math.min(score, 1.2);
}

function inferirEstrategia(
  tipoErro?: ErrorType | null,
  resumo?: MetadadosCognitivosResumo
): EstrategiaIntervencao {
  const etapa = resumo?.etapaDominante;
  if (etapa === "sabia_mas_nao_modelei") return "modelagem_guiada";
  if (etapa === "nao_sabia_o_conceito" || tipoErro === "CONCEITO_TEORICO") {
    return "revisao_conceitual";
  }
  if (etapa === "nao_entendi_o_comando" || tipoErro === "INTERPRETACAO_ENUNCIADO") {
    return "modelagem_guiada";
  }
  if (etapa === "chutei" || tipoErro === "CHUTE_TOTAL") return "engenharia_reversa";
  if (etapa === "faltou_tempo" || tipoErro === "FALTA_TEMPO") {
    return "treino_cronometrado";
  }
  if (etapa === "confundi_conceitos") return "comparacao_de_conceitos";
  if (etapa === "troquei_alternativa") return "metacognicao";
  if (etapa === "errei_calculo" || tipoErro === "CALCULO_BOBEIRA") return "refazer_erro";
  return "mini_simulado_dirigido";
}

function gerarHipoteseCausa(
  escopo: EscopoScore,
  resumo?: MetadadosCognitivosResumo
): string {
  if (resumo?.resumoTexto && resumo.resumoTexto !== "Sem metadados detalhados") {
    return `Nos erros deste escopo, o padrão mais frequente foi: ${resumo.resumoTexto}.`;
  }
  if (escopo.tipoErroDominante === "CONCEITO_TEORICO") {
    return "Os erros indicam lacuna conceitual no conteúdo exigido, não apenas descuido.";
  }
  if (escopo.tipoErroDominante === "INTERPRETACAO_ENUNCIADO") {
    return "O aluno parece saber parte da teoria, mas não traduz o enunciado em modelo resolvível.";
  }
  if (escopo.recorrencia >= 2) {
    return `Este escopo reapareceu em ${escopo.recorrencia} registros — não parece evento isolado.`;
  }
  return `Vulnerabilidade em ${escopo.escopoLabel} com ${escopo.erros} erro(s) neste registro.`;
}

function gerarObjetivoSemana(escopo: EscopoScore, estrategia: EstrategiaIntervencao): string {
  const labels: Record<EstrategiaIntervencao, string> = {
    revisao_conceitual: `Dominar a base conceitual de ${escopo.escopoLabel}.`,
    modelagem_guiada: `Montar o modelo (figura, esquema ou estrutura) antes de calcular/resolver em ${escopo.escopoLabel}.`,
    engenharia_reversa: `Refazer questões erradas explicando cada passo em ${escopo.escopoLabel}.`,
    treino_cronometrado: `Resolver questões de ${escopo.escopoLabel} com tempo controlado.`,
    comparacao_de_conceitos: `Diferenciar conceitos próximos em ${escopo.escopoLabel}.`,
    refazer_erro: `Eliminar erros de execução em ${escopo.escopoLabel} refazendo as questões originais.`,
    mini_simulado_dirigido: `Consolidar ${escopo.escopoLabel} com bloco curto de questões semelhantes.`,
    metacognicao: `Identificar quando a dúvida aparece e fixar critério de escolha em ${escopo.escopoLabel}.`,
  };
  return labels[estrategia];
}

export function buildEscopoScores(
  currentAttempts: AttemptInput[],
  historicalAttempts: AttemptInput[][] = [],
  options?: { weight?: number; anamnese?: AnamneseContext }
): EscopoScore[] {
  const weight = options?.weight ?? 1;
  const escoposIndex = indexGlobalEscopos();
  const recorrenciaMap = new Map<string, number>();

  for (const batch of historicalAttempts) {
    for (const a of batch) {
      if (a.correto || !a.conhecimentoEscopoId) continue;
      const id = a.conhecimentoEscopoId;
      recorrenciaMap.set(id, (recorrenciaMap.get(id) ?? 0) + 1);
    }
  }
  for (const a of currentAttempts) {
    if (!a.correto && a.conhecimentoEscopoId) {
      const id = a.conhecimentoEscopoId;
      recorrenciaMap.set(id, (recorrenciaMap.get(id) ?? 0) + 1);
    }
  }

  type Acc = {
    escopoId: string;
    materiaId: string;
    dominioId: string;
    escopoLabel: string;
    total: number;
    erros: number;
    acertos: number;
    numerosErrados: number[];
    conhecimentoExigidoSamples: string[];
    conceitosCanonicos: Set<string>;
    confiancas: number[];
    tiposErro: ErrorType[];
    metadados: AttemptInput["metadadosCognitivos"][];
  };

  const map = new Map<string, Acc>();

  for (const a of currentAttempts) {
    const escopoId = a.conhecimentoEscopoId?.trim();
    if (!escopoId) continue;

    const entry = escoposIndex.get(escopoId);
    const materiaId = a.materiaId ?? entry?.materiaId ?? "geral";
    if (escopoEhFallback(escopoId, materiaId)) continue;
    if (
      a.classificacaoConfianca != null &&
      a.classificacaoConfianca < CONFIANCA_MINIMA
    ) {
      continue;
    }

    const acc =
      map.get(escopoId) ??
      ({
        escopoId,
        materiaId,
        dominioId: a.conhecimentoDominioId ?? entry?.dominioId ?? "",
        escopoLabel: entry?.escopoLabel ?? escopoId,
        total: 0,
        erros: 0,
        acertos: 0,
        numerosErrados: [],
        conhecimentoExigidoSamples: [],
        conceitosCanonicos: new Set<string>(),
        confiancas: [],
        tiposErro: [],
        metadados: [],
      } satisfies Acc);

    acc.total++;
    if (a.correto) acc.acertos++;
    else {
      acc.erros++;
      acc.numerosErrados.push(a.numero);
      if (a.tipoErro) acc.tiposErro.push(a.tipoErro);
      if (a.metadadosCognitivos) acc.metadados.push(a.metadadosCognitivos);
    }
    if (a.conhecimentoExigido?.trim()) {
      acc.conhecimentoExigidoSamples.push(a.conhecimentoExigido.trim());
    }
    for (const c of a.conceitosCanonicos ?? []) acc.conceitosCanonicos.add(c);
    if (a.classificacaoConfianca != null) acc.confiancas.push(a.classificacaoConfianca);

    map.set(escopoId, acc);
  }

  const scores: EscopoScore[] = [];

  for (const acc of map.values()) {
    const recorrencia = recorrenciaMap.get(acc.escopoId) ?? 0;
    const taxaAcerto = acc.total > 0 ? acc.acertos / acc.total : 0;
    const errosPonderados = acc.erros * weight;
    const confMedia =
      acc.confiancas.length > 0
        ? acc.confiancas.reduce((s, v) => s + v, 0) / acc.confiancas.length
        : undefined;

    const tipoCounts = new Map<ErrorType, number>();
    for (const t of acc.tiposErro) tipoCounts.set(t, (tipoCounts.get(t) ?? 0) + 1);
    let tipoErroDominante: ErrorType | null = null;
    let maxTipo = 0;
    for (const [t, n] of tipoCounts) {
      if (n > maxTipo) {
        maxTipo = n;
        tipoErroDominante = t;
      }
    }

    const metadadosResumo = agregarMetadadosCognitivos(acc.metadados);
    const poucaEvidencia = acc.total <= 1 && recorrencia <= 1 ? 1 : 0;
    const baixaConfianca =
      confMedia != null && confMedia < CONFIANCA_MINIMA ? 2 : 0;

    const escopoParcial: EscopoScore = {
      materiaId: acc.materiaId,
      materiaLabel: getMateriaLabel(acc.materiaId),
      dominioId: acc.dominioId,
      escopoId: acc.escopoId,
      escopoLabel: acc.escopoLabel,
      conhecimentoExigidoSamples: [...new Set(acc.conhecimentoExigidoSamples)].slice(0, 5),
      conceitosCanonicos: [...acc.conceitosCanonicos],
      total: acc.total,
      erros: acc.erros,
      acertos: acc.acertos,
      taxaAcerto,
      vulnerabilidade: acc.total > 0 ? acc.erros / acc.total : 0,
      recorrencia,
      prioridadeScore: 0,
      numerosErrados: acc.numerosErrados.sort((a, b) => a - b),
      tipoErroDominante,
      metadadosCognitivosResumo: metadadosResumo,
      classificacaoConfiancaMedia: confMedia,
    };

    const prioridadeScore =
      errosPonderados * 1.0 +
      recorrencia * 2.0 +
      impactoMateria(acc.materiaId) * 1.5 +
      tipoErroCriticoScore(tipoErroDominante) * 1.0 +
      anamneseConfirmaEscopo(escopoParcial, options?.anamnese) * 0.8 -
      baixaConfianca * 2.0 -
      poucaEvidencia * 1.0;

    scores.push({ ...escopoParcial, prioridadeScore });
  }

  return scores.sort((a, b) => b.prioridadeScore - a.prioridadeScore);
}

export function buildFocosPedagogicos(
  escopoScores: EscopoScore[],
  attempts: AttemptInput[],
  anamnese?: AnamneseContext
): FocoPedagogico[] {
  const focos: FocoPedagogico[] = [];

  for (const escopo of escopoScores.filter((s) => s.erros > 0)) {
    if (escopo.total <= 1 && escopo.recorrencia <= 1 && escopo.prioridadeScore < 2) {
      continue;
    }

    const estrategia = inferirEstrategia(
      escopo.tipoErroDominante,
      escopo.metadadosCognitivosResumo
    );
    const hipotese = gerarHipoteseCausa(escopo, escopo.metadadosCognitivosResumo);

    let prioridade: FocoPedagogico["prioridade"] = "media";
    if (escopo.prioridadeScore >= 4 || escopo.recorrencia >= 2) prioridade = "alta";
    else if (escopo.taxaAcerto >= 0.7 && escopo.erros <= 1) prioridade = "manutencao";

    if (anamnese?.materiasFortes?.some((m) => escopo.materiaLabel.toLowerCase().includes(m.toLowerCase()))) {
      if (prioridade === "alta" && escopo.erros <= 1) prioridade = "media";
    }

    focos.push({
      focoId: escopo.escopoId,
      materiaId: escopo.materiaId,
      materiaLabel: escopo.materiaLabel,
      dominioId: escopo.dominioId,
      escopoId: escopo.escopoId,
      escopoLabel: escopo.escopoLabel,
      conhecimentoExigido: escopo.conhecimentoExigidoSamples,
      conceitosCanonicos: escopo.conceitosCanonicos,
      numerosErrados: escopo.numerosErrados,
      totalErros: escopo.erros,
      taxaAcerto: escopo.taxaAcerto,
      prioridade,
      tipoErroDominante: escopo.tipoErroDominante,
      metadadosCognitivosResumo: escopo.metadadosCognitivosResumo,
      hipoteseCausa: hipotese,
      objetivoDaSemana: gerarObjetivoSemana(escopo, estrategia),
      estrategiaRecomendada: estrategia,
    });
  }

  void attempts;
  return rankFocosPedagogicos(focos);
}

export function rankFocosPedagogicos(focos: FocoPedagogico[]): FocoPedagogico[] {
  const ordem = { alta: 0, media: 1, manutencao: 2 } as const;
  return [...focos].sort((a, b) => {
    const pa = ordem[a.prioridade];
    const pb = ordem[b.prioridade];
    if (pa !== pb) return pa - pb;
    return b.totalErros - a.totalErros;
  });
}

export function anamneseMotorToContext(
  ctx: import("@/lib/anamnese-types").AnamneseMotorContext | null | undefined
): AnamneseContext | undefined {
  if (!ctx?.profile) return undefined;
  const p = ctx.profile;
  return {
    resumo: ctx.summary,
    padroesDeclarados: p.declaredPatterns,
    materiasFracas: p.academicSelfPerception.perceivedWeakSubjects,
    materiasFortes: p.academicSelfPerception.perceivedStrongSubjects,
    fadigaProvaLonga: p.examBehavior.fatigueInLongExams,
    ansiedade: p.examBehavior.anxietyOrBlanking,
    maturidadeMetacognitiva: p.metacognition.metacognitiveMaturity ?? null,
    confianca: p.emotionalContext.confidenceLevel ?? null,
    bloqueio: p.academicSelfPerception.mainDeclaredBlocker ?? null,
  };
}
