import type {
  EstadoDuranteQuestao,
  EtapaDoErro,
  MetadadosCognitivosErro,
  TipoErroMetacognitivo,
} from "@/lib/metadados-cognitivos";

export const ETAPAS_DO_ERRO_UI: Array<{ value: EtapaDoErro; label: string }> = [
  { value: "nao_entendi_o_comando", label: "Não entendi o que a questão pedia" },
  { value: "nao_sabia_o_conceito", label: "Não sabia o conceito / teoria" },
  { value: "sabia_mas_nao_modelei", label: "Sabia a teoria, mas não montei o modelo" },
  { value: "errei_calculo", label: "Errei na conta ou no procedimento" },
  { value: "errei_por_pressa", label: "Fui rápido demais / descuido" },
  { value: "chutei", label: "Chutei a alternativa" },
  { value: "troquei_alternativa", label: "Estava certo e troquei no final" },
  { value: "faltou_tempo", label: "Não deu tempo de terminar" },
  { value: "nao_revisei", label: "Não revisei / não voltei na questão" },
  { value: "confundi_conceitos", label: "Confundi conceitos parecidos" },
];

export const ESTADOS_DURANTE_QUESTAO_UI: Array<{
  value: EstadoDuranteQuestao;
  label: string;
}> = [
  { value: "tranquilo", label: "Tranquilo" },
  { value: "inseguro", label: "Inseguro" },
  { value: "ansioso", label: "Ansioso" },
  { value: "cansado", label: "Cansado" },
  { value: "pressionado_pelo_tempo", label: "Pressionado pelo tempo" },
  { value: "desatento", label: "Desatento" },
];

export const CONFIANCA_LABELS: Record<number, string> = {
  1: "Chutei",
  2: "Pouca confiança",
  3: "Razoável",
  4: "Bem seguro",
  5: "Certeza total",
};

/** Sugere etapa a partir do tipo de erro legado (dropdown clássico). */
export function sugerirEtapaDeTipoErro(tipo: string): EtapaDoErro | "" {
  const map: Partial<Record<TipoErroMetacognitivo, EtapaDoErro>> = {
    CONCEITO_TEORICO: "nao_sabia_o_conceito",
    CALCULO_BOBEIRA: "errei_calculo",
    INTERPRETACAO_ENUNCIADO: "nao_entendi_o_comando",
    DUVIDA_CRUCIAL: "troquei_alternativa",
    CHUTE_TOTAL: "chutei",
    FALTA_TEMPO: "faltou_tempo",
  };
  return (tipo && map[tipo as TipoErroMetacognitivo]) || "";
}

export type MetadadosErroForm = {
  tipoErro: string;
  observacao: string;
  etapaDoErro: string;
  confiancaNaResposta: string;
  estadoDuranteQuestao: string;
};

export function metadadosFormFromAttempt(input: {
  tipoErro?: string | null;
  observacao?: string | null;
  metadadosCognitivosJson?: string | null;
}): MetadadosErroForm {
  let meta: MetadadosCognitivosErro | null = null;
  if (input.metadadosCognitivosJson?.trim()) {
    try {
      meta = JSON.parse(input.metadadosCognitivosJson) as MetadadosCognitivosErro;
    } catch {
      meta = null;
    }
  }

  const tipoErro = input.tipoErro || meta?.tipoErro || "";
  const etapa =
    meta?.etapaDoErro ||
    (tipoErro ? sugerirEtapaDeTipoErro(tipoErro) : "") ||
    "";

  return {
    tipoErro,
    observacao: input.observacao || meta?.observacaoAluno || "",
    etapaDoErro: etapa,
    confiancaNaResposta: meta?.confiancaNaResposta
      ? String(meta.confiancaNaResposta)
      : "",
    estadoDuranteQuestao: meta?.estadoDuranteQuestao || "",
  };
}

export function buildMetadadosFromForm(
  form: MetadadosErroForm
): MetadadosCognitivosErro | null {
  const hasAlgo =
    form.tipoErro ||
    form.etapaDoErro ||
    form.confiancaNaResposta ||
    form.estadoDuranteQuestao ||
    form.observacao.trim();

  if (!hasAlgo) return null;

  const conf = form.confiancaNaResposta
    ? (Number(form.confiancaNaResposta) as 1 | 2 | 3 | 4 | 5)
    : undefined;

  return {
    tipoErro: (form.tipoErro || undefined) as MetadadosCognitivosErro["tipoErro"],
    etapaDoErro: (form.etapaDoErro || undefined) as EtapaDoErro | undefined,
    confiancaNaResposta:
      conf && conf >= 1 && conf <= 5 ? conf : undefined,
    estadoDuranteQuestao: (form.estadoDuranteQuestao ||
      undefined) as EstadoDuranteQuestao | undefined,
    observacaoAluno: form.observacao.trim() || undefined,
  };
}
