/**
 * Tradução humana do motor — storytelling cognitivo (não laudo técnico).
 */
import type { ErrorType } from "@/generated/prisma/client";
import { fraseContextoLongitudinal } from "@/lib/comportamento-longitudinal";
import type { ClusterAgregado } from "@/lib/diagnostic-motor";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";

export type CamadasNarrativa = {
  oQueAcontece: string;
  comoCognitivo: string;
  quandoAparece: string;
  naoSignifica: string;
  caminho: string;
};

export type NarrativaCopiloto = {
  titulo: string;
  paragrafo: string;
  camadas: CamadasNarrativa;
  linhaFoco: string;
  proximoPasso: string;
  exemploConcreto: string | null;
  causaComoVoceErra: string | null;
};

const CAUSA_BADGE: Partial<Record<ErrorType, string>> = {
  CONCEITO_TEORICO: "conceito não veio na hora",
  INTERPRETACAO_ENUNCIADO: "leitura do comando",
  CALCULO_BOBEIRA: "conta no final",
  FALTA_TEMPO: "pressa no tempo",
  CHUTE_TOTAL: "insegurança no conteúdo",
  DUVIDA_CRUCIAL: "dúvida aberta",
};

const CAUSA_COMPORTAMENTO: Partial<Record<ErrorType, string>> = {
  CONCEITO_TEORICO:
    "na hora da questão o conceito não veio — você até conhece o tema, mas não conseguiu puxar na pressão",
  INTERPRETACAO_ENUNCIADO: "o que pesou foi entender o que a questão pedia, antes de qualquer conteúdo",
  CALCULO_BOBEIRA: "o caminho fazia sentido, mas a execução da conta ou do último passo escapou",
  FALTA_TEMPO: "o tempo apertando entrou na história — não só o conteúdo",
  CHUTE_TOTAL: "houve insegurança forte no conteúdo — vale fechar base antes de listas enormes",
  DUVIDA_CRUCIAL: "ficou uma dúvida pontual sem fechar antes da prova",
};

function materiaPrincipal(
  principal: ClusterAgregado,
  materiaDeficit: { label: string; pct: number } | null
): string {
  const alvo = materiaDeficit?.label.toLowerCase().slice(0, 5) ?? "";
  const match =
    alvo &&
    principal.materias.find((m) => m.nome.toLowerCase().includes(alvo))?.nome;
  return match ?? principal.materias[0]?.nome ?? materiaDeficit?.label ?? "suas provas";
}

function fraseComoErra(causa: ErrorType | null): string | null {
  if (!causa) return null;
  return CAUSA_COMPORTAMENTO[causa] ?? null;
}

function fraseDeficit(
  materiaDeficit: { label: string; pct: number } | null,
  materia: string
): string | null {
  if (!materiaDeficit) return null;
  if (materiaCoincideSimples(materia, materiaDeficit.label)) {
    return `Em ${materiaDeficit.label}, você está com ${materiaDeficit.pct}% de acerto na jornada — há espaço real para ganhar nota com treino certo.`;
  }
  return `Onde mais dá para subir nota agora é ${materiaDeficit.label} (${materiaDeficit.pct}% na jornada); o padrão que descrevemos abaixo aparece forte em ${materia}.`;
}

function materiaCoincideSimples(a: string, b: string): boolean {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  return na.includes(nb) || nb.includes(na);
}

export function narrativaCopiloto(
  principal: ClusterAgregado,
  materiaDeficit: { label: string; pct: number } | null,
  _totalProvas: number
): NarrativaCopiloto {
  const def = CLUSTERS_PEDAGOGICOS[principal.clusterId];
  const mat = materiaPrincipal(principal, materiaDeficit);
  const comp = principal.comportamento;

  const oQueAcontece = def.situacaoObservavel;
  const comoCognitivo = [
    def.experienciaIntegracao,
    fraseComoErra(principal.causaDominante?.tipo ?? null),
  ]
    .filter(Boolean)
    .join(" ");

  const quandoAparece = fraseContextoLongitudinal(comp, mat);
  const naoSignifica = def.naoSignifica;
  const caminho = def.caminhoEsperanca;

  const deficitIntro = fraseDeficit(materiaDeficit, mat);

  const paragrafo = [
    deficitIntro ??
      (materiaDeficit
        ? `Você não está “perdida” em tudo — o que mais pesa agora tem forma e dá para treinar.`
        : "O que mais pesa na sua jornada tem forma e dá para treinar."),
    oQueAcontece,
    comoCognitivo,
    quandoAparece,
    naoSignifica,
    caminho,
  ]
    .filter(Boolean)
    .join(" ");

  const linhaFoco = materiaDeficit
    ? `Esta semana: atacar isso em ${materiaDeficit.label} — é onde a nota mais responde agora.`
    : `Esta semana: treinar esse padrão com método, não no improviso.`;

  const titulo = def.tituloHumano;

  const causaComoVoceErra = principal.causaDominante
    ? (CAUSA_BADGE[principal.causaDominante.tipo] ?? null)
    : null;

  return {
    titulo,
    paragrafo,
    camadas: { oQueAcontece, comoCognitivo, quandoAparece, naoSignifica, caminho },
    linhaFoco,
    proximoPasso: def.proximoPassoSemana,
    exemploConcreto: null,
    causaComoVoceErra,
  };
}

/** Uma linha para “também vale atenção” */
export function resumoClusterHumano(c: ClusterAgregado): string {
  const def = CLUSTERS_PEDAGOGICOS[c.clusterId];
  const mat = c.materias[0]?.nome;
  let s = def.experienciaIntegracao;
  if (mat) s += ` (${mat})`;
  if (c.comportamento.recorrencia === "forte") {
    s += " — padrão recorrente na jornada.";
  }
  return s;
}
