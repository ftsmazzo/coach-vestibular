import {
  minimoQuestoesEstrutura,
  type EstruturaProvaDetectada,
} from "@/lib/prova-pipeline-contexto";

export type { EstruturaProvaDetectada };

/** Mínimo de caracteres no enunciado literal para considerar extração válida. */
export const ENUNCIADO_LITERAL_MIN_CHARS = 40;

export type ExtracaoLiteralLoteRes = {
  questoes?: Array<{
    numero: number;
    area_bloco?: string;
    enunciado?: string;
    alternativas?: string;
    dificuldade?: string;
  }>;
};

/** @deprecated use ExtracaoLiteralLoteRes */
export type ExtracaoPedagogicaLoteRes = ExtracaoLiteralLoteRes & {
  questoes?: Array<{
    numero: number;
    area_bloco?: string;
    resumo_enunciado?: string;
    enunciado?: string;
    alternativas?: string;
    dificuldade?: string;
  }>;
};

/** @deprecated use ExtracaoLiteralLoteRes */
export type ClassificacaoLoteRes = ExtracaoPedagogicaLoteRes & {
  questoes?: Array<{
    numero: number;
    area_bloco?: string;
    materia?: string;
    assunto?: string;
    conhecimento?: string;
    dificuldade?: string;
    resumo_enunciado?: string;
    enunciado?: string;
    alternativas?: string;
  }>;
};

function ratioMinimo(): number {
  const r = parseFloat(process.env.PIPELINE_V2_MIN_COVERAGE ?? "0.55");
  return Number.isFinite(r) && r > 0 && r <= 1 ? r : 0.55;
}

export function validarEstruturaProva(
  data: EstruturaProvaDetectada,
  totalEsperado: number
): void {
  if (!data || !Array.isArray(data.numeros)) {
    throw new Error("Resposta estrutural sem lista de números");
  }

  const nums = [...new Set(data.numeros.filter((n) => Number.isInteger(n) && n > 0 && n <= 500))];
  const minimoCadastro = minimoQuestoesEstrutura(totalEsperado);
  const detectado = data.total_questoes_detectado;
  const minimoDetectado =
    typeof detectado === "number" && detectado > 0
      ? Math.max(3, Math.ceil(detectado * ratioMinimo()))
      : minimoCadastro;

  const minimo = Math.min(minimoCadastro, minimoDetectado);

  if (nums.length < minimo) {
    throw new Error(
      `Poucos números no PDF (${nums.length}; mínimo ~${minimo} para cadastro de ${totalEsperado})`
    );
  }

  if (data.numeros.length > nums.length + 5) {
    throw new Error(
      `Muitas numerações duplicadas ou inválidas (${data.numeros.length} → ${nums.length} únicos)`
    );
  }
}

function textoEnunciadoQuestao(q: {
  enunciado?: string;
  resumo_enunciado?: string;
}): string {
  return (q.enunciado ?? q.resumo_enunciado ?? "").trim();
}

export function validarExtracaoLiteralLote(
  data: ExtracaoLiteralLoteRes,
  numerosEsperados: number[]
): void {
  if (!data?.questoes || !Array.isArray(data.questoes)) {
    throw new Error("Extração sem array de questões");
  }

  const esperados = new Set(numerosEsperados);
  const noLote = data.questoes.filter((q) => esperados.has(q.numero));
  const minimo = Math.max(1, Math.ceil(numerosEsperados.length * ratioMinimo()));

  if (noLote.length < minimo) {
    throw new Error(
      `Lote incompleto: ${noLote.length}/${numerosEsperados.length} questões (mínimo ${minimo})`
    );
  }

  let semEnunciado = 0;
  let enunciadoCurto = 0;
  let semDificuldade = 0;
  for (const q of noLote) {
    const d = (q.dificuldade ?? "").trim().toLowerCase();
    if (d && !["facil", "media", "dificil", "fácil", "média", "difícil"].includes(d)) {
      throw new Error(`Dificuldade inválida na questão ${q.numero}`);
    }
    const en = textoEnunciadoQuestao(q);
    if (!en) semEnunciado++;
    else if (en.length < ENUNCIADO_LITERAL_MIN_CHARS) enunciadoCurto++;
    if (!d) semDificuldade++;
  }

  const maxSemEnunciado = Math.ceil(noLote.length * 0.15);
  if (semEnunciado > maxSemEnunciado) {
    throw new Error(
      `Muitas questões sem enunciado literal (${semEnunciado}/${noLote.length})`
    );
  }

  const maxCurto = Math.ceil(noLote.length * 0.35);
  if (enunciadoCurto > maxCurto) {
    throw new Error(
      `Muitas questões com enunciado muito curto — possível resumo em vez de texto literal (${enunciadoCurto}/${noLote.length})`
    );
  }

  const maxSemDificuldade = Math.floor(noLote.length * 0.85);
  if (semDificuldade > maxSemDificuldade) {
    throw new Error(
      `Poucas questões com dificuldade (${noLote.length - semDificuldade}/${noLote.length}); preencha facil/media/dificil quando legível`
    );
  }
}

/** @deprecated use validarExtracaoLiteralLote */
export function validarExtracaoPedagogicaLote(
  data: ExtracaoPedagogicaLoteRes,
  numerosEsperados: number[]
): void {
  validarExtracaoLiteralLote(data, numerosEsperados);
}

/** @deprecated use validarExtracaoLiteralLote */
export function validarClassificacaoLote(
  data: ClassificacaoLoteRes,
  numerosEsperados: number[]
): void {
  validarExtracaoLiteralLote(data, numerosEsperados);
}
