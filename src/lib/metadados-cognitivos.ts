/** Metadados cognitivos — como o aluno se relacionou com o erro (individualiza a intervenção). */

export type TipoErroMetacognitivo =
  | "CONCEITO_TEORICO"
  | "CALCULO_BOBEIRA"
  | "INTERPRETACAO_ENUNCIADO"
  | "DUVIDA_CRUCIAL"
  | "CHUTE_TOTAL"
  | "FALTA_TEMPO";

export type EtapaDoErro =
  | "nao_entendi_o_comando"
  | "nao_sabia_o_conceito"
  | "sabia_mas_nao_modelei"
  | "errei_calculo"
  | "errei_por_pressa"
  | "chutei"
  | "troquei_alternativa"
  | "faltou_tempo"
  | "nao_revisei"
  | "confundi_conceitos";

export type EstadoDuranteQuestao =
  | "tranquilo"
  | "inseguro"
  | "ansioso"
  | "cansado"
  | "pressionado_pelo_tempo"
  | "desatento";

export type MetadadosCognitivosErro = {
  tipoErro?: TipoErroMetacognitivo;
  observacaoAluno?: string;
  confiancaNaResposta?: 1 | 2 | 3 | 4 | 5;
  percebeuErroDepois?: boolean;
  estavaEntreAlternativas?: string[];
  motivoDaEscolha?: string;
  etapaDoErro?: EtapaDoErro;
  estadoDuranteQuestao?: EstadoDuranteQuestao;
  tempoEstimado?: "rapido" | "normal" | "demorado" | "nao_deu_tempo";
  revisaoAluno?: {
    entendeuDepois?: boolean;
    explicacaoPropria?: string;
    precisaRever?: boolean;
  };
};

export type MetadadosCognitivosResumo = {
  tipoErroDominante?: string | null;
  etapaDominante?: string | null;
  estadoDominante?: string | null;
  amostrasObservacao: string[];
  confiancaMedia?: number | null;
  resumoTexto: string;
};

export function parseMetadadosCognitivos(
  raw: string | null | undefined
): MetadadosCognitivosErro | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as MetadadosCognitivosErro;
  } catch {
    return null;
  }
}

export function agregarMetadadosCognitivos(
  items: Array<MetadadosCognitivosErro | null | undefined>
): MetadadosCognitivosResumo | undefined {
  const valid = items.filter(Boolean) as MetadadosCognitivosErro[];
  if (valid.length === 0) return undefined;

  const count = (vals: (string | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) {
      if (!v) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    let best = "";
    let max = 0;
    for (const [k, n] of m) {
      if (n > max) {
        max = n;
        best = k;
      }
    }
    return max > 0 ? best : null;
  };

  const tipoErroDominante = count(valid.map((v) => v.tipoErro));
  const etapaDominante = count(valid.map((v) => v.etapaDoErro));
  const estadoDominante = count(valid.map((v) => v.estadoDuranteQuestao));
  const confs = valid
    .map((v) => v.confiancaNaResposta)
    .filter((c): c is number => c != null);
  const confiancaMedia =
    confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
  const amostrasObservacao = valid
    .map((v) => v.observacaoAluno?.trim())
    .filter(Boolean)
    .slice(0, 3) as string[];

  const partes: string[] = [];
  if (etapaDominante) partes.push(etapaDominante.replace(/_/g, " "));
  if (tipoErroDominante) partes.push(tipoErroDominante.replace(/_/g, " ").toLowerCase());
  if (amostrasObservacao[0]) partes.push(`"${amostrasObservacao[0].slice(0, 80)}"`);

  return {
    tipoErroDominante,
    etapaDominante,
    estadoDominante,
    amostrasObservacao,
    confiancaMedia,
    resumoTexto: partes.join(" · ") || "Sem metadados detalhados",
  };
}
