/**
 * Textos da Home — tom de copiloto (direção, conforto, ação concreta).
 * A inferência estatística fica no motor; aqui só a “tradução humana”.
 */
import type { ErrorType } from "@/generated/prisma/client";
import { getTipoErroLabel } from "@/lib/taxonomy";
import type { ClusterAgregado } from "@/lib/diagnostic-motor";
import {
  CLUSTERS_PEDAGOGICOS,
  type PedagogicalClusterId,
} from "@/lib/pedagogical-clusters";

export type NarrativaCopiloto = {
  titulo: string;
  /** História integrada: déficit + padrão + metacognição + exemplo */
  paragrafo: string;
  /** Uma linha de foco (substitui “prioridade estatística”) */
  linhaFoco: string;
  /** Ação desta semana — vai na missão */
  proximoPasso: string;
  exemploConcreto: string | null;
  /** Como o erro se manifesta (humano), para badge */
  causaComoVoceErra: string | null;
};

const CAUSA_HUMANA: Partial<Record<ErrorType, string>> = {
  CONCEITO_TEORICO: "o conceito não veio na hora",
  INTERPRETACAO_ENUNCIADO: "leitura do que foi pedido",
  CALCULO_BOBEIRA: "conta ou passo final",
  FALTA_TEMPO: "pressa no final da prova",
  CHUTE_TOTAL: "insegurança no conteúdo",
  DUVIDA_CRUCIAL: "uma dúvida que ficou aberta",
};

function pluralProvas(n: number): string {
  if (n <= 1) return "na prova que você registrou";
  if (n === 2) return "nas 2 provas que você registrou";
  return `nas ${n} provas que você registrou`;
}

function simplificarExemplo(texto: string): string {
  let t = texto
    .replace(/^Relacionar\s+/i, "relacionar ")
    .replace(/^Aplicar\s+/i, "aplicar ")
    .replace(/^Modelar\s+/i, "modelar ")
    .replace(/\.$/, "");
  if (t.length > 120) t = `${t.slice(0, 117)}…`;
  return t;
}

function metacognicaoNaFrase(causa: ErrorType | null, pct: number | null): string | null {
  if (!causa) return null;
  const como = CAUSA_HUMANA[causa];
  if (!como) return null;
  const label = getTipoErroLabel(causa) ?? causa;
  if (pct != null && pct >= 50) {
    return `Em boa parte desses erros, o que mais pesou foi ${como} — não é só “falta de atenção”. (${label}, ~${pct}%).`;
  }
  return `O que mais aparece nesses erros é ${como} — vale atacar isso de propósito, não só revisar tudo de novo.`;
}

function tituloCopiloto(clusterId: PedagogicalClusterId, materiaDeficit: string | null): string {
  const def = CLUSTERS_PEDAGOGICOS[clusterId];
  const mapa: Partial<Record<PedagogicalClusterId, string>> = {
    visualizacao_espacial: "Figuras e geometria na sua reta",
    modelagem_matematica: "Do texto do problema à conta",
    calculo_procedimento: "Conta e procedimento com segurança",
    interpretacao_textual: "Leitura longa sem perder o fio",
    analise_linguistica: "Gramática sob pressão de prova",
    recuperacao_conceitual: "Teoria na hora da questão",
    comparacao_contextual: "Comparar e concluir com critério",
    inferencia_logica: "Encadear o raciocínio",
    aplicacao_conceitual: "Conceito em situação nova",
  };
  const base = mapa[clusterId] ?? def.label;
  if (materiaDeficit && clusterId === "visualizacao_espacial") {
    return `${base} (${materiaDeficit})`;
  }
  return base;
}

export function narrativaCopiloto(
  principal: ClusterAgregado,
  materiaDeficit: { label: string; pct: number } | null,
  totalProvas: number
): NarrativaCopiloto {
  const def = CLUSTERS_PEDAGOGICOS[principal.clusterId];
  const materiaPrincipal =
    (materiaDeficit &&
      principal.materias.find((m) =>
        m.nome.toLowerCase().includes(materiaDeficit.label.toLowerCase().slice(0, 5))
      )?.nome) ??
    principal.materias[0]?.nome ??
    materiaDeficit?.label ??
    "suas provas";

  const titulo = tituloCopiloto(principal.clusterId, materiaDeficit?.label ?? null);

  const linhaFoco = materiaDeficit
    ? `Foco da semana: ${def.label.toLowerCase()} em ${materiaDeficit.label}, onde você mais precisa subir hoje (${materiaDeficit.pct}% de acerto na jornada).`
    : `Foco da semana: ${def.label.toLowerCase()} — apareceu em ${principal.erros} questões que você errou.`;

  const provasTxt = pluralProvas(totalProvas);
  const repete =
    principal.erros >= 3
      ? `Isso voltou ${principal.erros} vezes ${provasTxt}, principalmente em ${materiaPrincipal}.`
      : `Apareceu ${provasTxt} em ${materiaPrincipal}.`;

  const deficitFrase =
    materiaDeficit && materiaDeficit.label !== materiaPrincipal
      ? `Sua matéria com mais espaço para ganhar nota agora é ${materiaDeficit.label} (${materiaDeficit.pct}% de acerto na jornada); em ${materiaPrincipal}, o padrão que mais se repete é este.`
      : materiaDeficit
        ? `Em ${materiaDeficit.label}, você está com ${materiaDeficit.pct}% de acerto na jornada — dá para melhorar com treino direcionado.`
        : "";

  const meta = metacognicaoNaFrase(
    principal.causaDominante?.tipo ?? null,
    principal.causaDominante?.pct ?? null
  );

  const exemplo =
    principal.evidencias[0] != null
      ? simplificarExemplo(principal.evidencias[0])
      : null;

  const exemploFrase = exemplo
    ? `Por exemplo: questões em que você precisava ${exemplo}.`
    : "";

  const abertura =
    "Dá para virar esse jogo — o caminho é treinar o que a questão pediu, não estudar tudo de uma vez.";

  const paragrafo = [
    abertura,
    deficitFrase,
    def.diagnosticoHumano,
    repete,
    meta,
    exemploFrase,
  ]
    .filter(Boolean)
    .join(" ");

  const proximoPasso = def.proximoPassoSemana;

  const causaComoVoceErra = principal.causaDominante
    ? getTipoErroLabel(principal.causaDominante.tipo) ?? principal.causaDominante.label
    : null;

  return {
    titulo,
    paragrafo,
    linhaFoco,
    proximoPasso,
    exemploConcreto: exemplo,
    causaComoVoceErra,
  };
}

/** Uma linha para lista “também vale atenção” */
export function resumoClusterHumano(c: ClusterAgregado): string {
  const def = CLUSTERS_PEDAGOGICOS[c.clusterId];
  const mat = c.materias[0]?.nome;
  const causa = c.causaDominante
    ? CAUSA_HUMANA[c.causaDominante.tipo]
    : null;
  let s = def.diagnosticoHumano;
  if (mat) s += ` (${mat})`;
  if (causa) s += ` — costuma ser ${causa}.`;
  return s;
}
