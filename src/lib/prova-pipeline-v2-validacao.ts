import {
  minimoQuestoesEstrutura,
  type EstruturaProvaDetectada,
  type ProvaPipelineContext,
} from "@/lib/prova-pipeline-contexto";
import {
  ocorrenciasMinimasCadastro,
  somaOrdensBlocos,
  type BlocoOrdemNumero,
} from "@/lib/prova-pipeline-ordem-numero";

export type { EstruturaProvaDetectada };

/** Mínimo de caracteres no enunciado literal para considerar extração válida. */
export const ENUNCIADO_LITERAL_MIN_CHARS = 40;

export type ExtracaoLiteralLoteRes = {
  questoes?: Array<{
    ordem: number;
    numero: number;
    enunciado?: string;
    alternativas?: string;
    resumo_enunciado?: string;
  }>;
};

function ratioMinimo(): number {
  const r = parseFloat(process.env.PIPELINE_V2_MIN_COVERAGE ?? "0.55");
  return Number.isFinite(r) && r > 0 && r <= 1 ? r : 0.55;
}

export function validarEstruturaProva(
  data: EstruturaProvaDetectada,
  totalEsperado: number,
  ctx?: Pick<
    ProvaPipelineContext,
    "politicaIdiomas" | "idiomaQuestaoInicio" | "idiomaQuestaoFim"
  >
): void {
  const ocorrencias = data.total_ocorrencias_detectado;
  const logicas =
    data.total_questoes_logicas ??
    data.total_questoes_detectado ??
    (Array.isArray(data.numeros_logicos)
      ? data.numeros_logicos.length
      : Array.isArray(data.numeros)
        ? new Set(data.numeros).size
        : 0);

  if (typeof ocorrencias !== "number" || ocorrencias < 1) {
    throw new Error("Resposta estrutural sem total_ocorrencias_detectado válido");
  }

  const minimoFisico = Math.max(3, Math.ceil(ocorrencias * ratioMinimo()));
  if (ocorrencias < minimoFisico) {
    throw new Error(`Poucas ocorrências detectadas no PDF (${ocorrencias})`);
  }

  const minimoLogico = minimoQuestoesEstrutura(totalEsperado);
  if (logicas > 0 && logicas < Math.min(minimoLogico, Math.ceil(totalEsperado * ratioMinimo()))) {
    throw new Error(
      `Poucos números lógicos no PDF (${logicas}; cadastro ${totalEsperado})`
    );
  }

  const blocos = (data.blocos ?? []) as BlocoOrdemNumero[];

  if (ocorrencias >= 4 && blocos.length === 0) {
    throw new Error(
      "Informe blocos com ordem_inicio/fim e questao_inicio/fim — necessário para mapear ordem física → número impresso."
    );
  }

  const somaOrdens = somaOrdensBlocos(blocos);
  if (blocos.length > 0 && somaOrdens > 0 && somaOrdens !== ocorrencias) {
    throw new Error(
      `Blocos somam ${somaOrdens} ordem(ns) física(s), mas total_ocorrencias_detectado=${ocorrencias} — revise blocos ou total.`
    );
  }

  for (const b of blocos) {
    if (!b.ordem_inicio || !b.ordem_fim || !b.questao_inicio || !b.questao_fim) {
      throw new Error(`Bloco «${b.titulo}» sem ordem_inicio/fim ou questao_inicio/fim.`);
    }
    const nOrd = b.ordem_fim - b.ordem_inicio + 1;
    const nNum = b.questao_fim - b.questao_inicio + 1;
    if (nOrd !== nNum) {
      throw new Error(
        `Bloco «${b.titulo}»: intervalo de ordens (${nOrd}) difere do de números (${nNum}).`
      );
    }
  }

  if (data.idiomas_estrangeiros === "duplicata_ingles_espanhol" && ocorrencias <= logicas) {
    throw new Error(
      `Duplicata EN/ES detectada, mas ocorrências físicas (${ocorrencias}) ≤ lógicas (${logicas}) — falta bloco EN ou ES.`
    );
  }

  if (ctx) {
    const minCadastro = ocorrenciasMinimasCadastro({
      totalEsperado,
      politicaIdiomas: ctx.politicaIdiomas,
      idiomaQuestaoInicio: ctx.idiomaQuestaoInicio,
      idiomaQuestaoFim: ctx.idiomaQuestaoFim,
    });
    if (minCadastro != null && ocorrencias < minCadastro) {
      throw new Error(
        `Cadastro indica ${minCadastro} ocorrência(s) física(s) mínima(s); PDF reportou ${ocorrencias}.`
      );
    }
  }
}

function textoEnunciadoQuestao(q: {
  enunciado?: string;
  resumo_enunciado?: string;
}): string {
  return (q.enunciado ?? q.resumo_enunciado ?? "").trim();
}

/** Valida lote de extração por ordens físicas esperadas (não por numero único). */
export function validarExtracaoLiteralLote(
  data: ExtracaoLiteralLoteRes,
  ordensEsperadas: number[]
): void {
  if (!data?.questoes || !Array.isArray(data.questoes)) {
    throw new Error("Extração sem array de questões");
  }

  const esperados = new Set(ordensEsperadas);
  const noLote = data.questoes.filter((q) => esperados.has(q.ordem));
  const minimo = Math.max(1, Math.ceil(ordensEsperadas.length * ratioMinimo()));

  if (noLote.length < minimo) {
    throw new Error(
      `Lote incompleto: ${noLote.length}/${ordensEsperadas.length} ocorrências (mínimo ${minimo})`
    );
  }

  let semEnunciado = 0;
  let enunciadoCurto = 0;
  for (const q of noLote) {
    if (!Number.isInteger(q.ordem) || q.ordem < 1) {
      throw new Error(`Ordem inválida na extração: ${q.ordem}`);
    }
    const en = textoEnunciadoQuestao(q);
    if (!en) semEnunciado++;
    else if (en.length < ENUNCIADO_LITERAL_MIN_CHARS) enunciadoCurto++;
  }

  const maxSemEnunciado = Math.ceil(noLote.length * 0.15);
  if (semEnunciado > maxSemEnunciado) {
    throw new Error(
      `Muitas ocorrências sem enunciado literal (${semEnunciado}/${noLote.length})`
    );
  }

  const maxCurto = Math.ceil(noLote.length * 0.35);
  if (enunciadoCurto > maxCurto) {
    throw new Error(
      `Muitas ocorrências com enunciado muito curto (${enunciadoCurto}/${noLote.length})`
    );
  }

  const sigs = new Map<string, number>();
  for (const q of noLote) {
    const en = textoEnunciadoQuestao(q);
    if (en.length < 80) continue;
    const sig = en.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    const prev = sigs.get(sig);
    if (prev != null && prev !== q.ordem) {
      throw new Error(
        `Ordens ${prev} e ${q.ordem} com enunciado idêntico no lote — localize cada ordem pelo mapa físico.`
      );
    }
    sigs.set(sig, q.ordem);
  }
}

/** @deprecated */
export function validarExtracaoPedagogicaLote(
  data: ExtracaoLiteralLoteRes,
  ordensEsperadas: number[]
): void {
  validarExtracaoLiteralLote(data, ordensEsperadas);
}

/** @deprecated */
export function validarClassificacaoLote(
  data: ExtracaoLiteralLoteRes,
  ordensEsperadas: number[]
): void {
  validarExtracaoLiteralLote(data, ordensEsperadas);
}
