/**
 * Etapa 4E — hipótese pedagógica do foco a partir da evidência canônica.
 */
import type { EvidenciaCanonicaFoco } from "@/lib/jornada-evidencia-canonica";
import { abreviarNomeProva } from "@/lib/jornada-labels";

export type ForcaDaEvidencia = "FORTE" | "MODERADA" | "INICIAL";

export type HipotesePedagogicaFoco = {
  forcaDaEvidencia: ForcaDaEvidencia;
  hipotese: string;
  sinais: string[];
  objetivoDaSemana: string;
  cuidadoInterpretativo: string;
  motivoParaAluno: string;
  motivoDiagnostico: string;
  /** Narrativa média — card Semana 1. */
  narrativaSemana: string;
  /** Texto longo com evidência detalhada — baseline/admin. */
  motivoSemana: string;
  /** Resumo curto — plano semanal. */
  resumoPlano: string;
  motivoQuest: string;
  criterioConclusao: string;
  baselineEvidencia: string;
  /** Ex.: "Q8 da FAMERP e Q87/Q89 da UNESP". */
  questoesRevisaoTexto: string;
};

export function isEscopoSomaAngulosFiguras(escopoId: string, label = ""): boolean {
  const s = `${escopoId} ${label}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    s.includes("soma_angulos") ||
    s.includes("soma de angulos") ||
    s.includes("angulos em figuras") ||
    s.includes("angulos_poligonos")
  );
}

export function isEscopoMatematicaGeometria(escopoId: string, label = ""): boolean {
  const s = `${escopoId} ${label}`.toLowerCase();
  return (
    s.startsWith("mat.") &&
    (s.includes("geometria") || isEscopoSomaAngulosFiguras(escopoId, label))
  );
}

export function inferirForcaDaEvidencia(ev: EvidenciaCanonicaFoco): ForcaDaEvidencia {
  if (ev.total >= 8 && ev.erros >= 5 && ev.provasComErro >= 2 && ev.pctErro >= 55) {
    return "FORTE";
  }
  if (ev.total >= 5 && ev.erros >= 4 && ev.provasComErro >= 2) {
    return "MODERADA";
  }
  if (ev.total <= 4 && ev.erros <= 4) {
    return "INICIAL";
  }
  if (ev.erros >= 3 && ev.provasComErro >= 2) {
    return "MODERADA";
  }
  return "INICIAL";
}

export function formatarBaselineEvidenciaCiclo(ev: EvidenciaCanonicaFoco): string {
  const base = `${ev.erros} erro(s) em ${ev.total} questão(ões), somando as provas consideradas`;
  const porProva = ev.ocorrenciasPorProva
    .filter((o) => o.erros > 0)
    .map((o) => {
      const nome = abreviarNomeProva(o.nome);
      const qs =
        o.numerosErradas.length > 0 ? ` (Q${o.numerosErradas.join(", Q")})` : "";
      return `${nome}: ${o.erros} erro(s)${qs}`;
    })
    .join("; ");
  return porProva ? `${base} — ${porProva}` : base;
}

/** Lista de questões erradas por prova para quest REVISAO_ERRO. */
export function formatarQuestoesRevisaoPorProva(ev: EvidenciaCanonicaFoco): string {
  const chunks = ev.ocorrenciasPorProva
    .filter((o) => o.erros > 0 && o.numerosErradas.length > 0)
    .map((o) => ({
      prova: abreviarNomeProva(o.nome),
      qs: o.numerosErradas.map((n) => `Q${n}`).join("/"),
    }));
  if (chunks.length === 0) return "";
  return chunks.map((c) => `${c.qs} da ${c.prova}`).join(" e ");
}

/** Motivo de prioridade inicial no diagnóstico — sempre usa contagem canônica agregada. */
export function motivoPrioridadeInicial(
  escopoLabel: string,
  evidencia?: EvidenciaCanonicaFoco
): string {
  if (!evidencia) {
    return `${escopoLabel} aparece como sinal inicial na amostra — evidência ainda limitada para conclusão definitiva.`;
  }
  const forca = inferirForcaDaEvidencia(evidencia);
  const amostra =
    forca === "INICIAL" ? "pequena" : forca === "MODERADA" ? "ainda limitada" : "consistente, mas não definitiva";
  return `${escopoLabel} aparece como primeira hipótese de intervenção: ${evidencia.erros} erro(s) em ${evidencia.total} questão(ões), somando as provas consideradas. A amostra ainda é ${amostra}, por isso não deve ser lida como conclusão definitiva.`;
}

function montarSinais(ev: EvidenciaCanonicaFoco, label: string): string[] {
  const sinais: string[] = [
    `${ev.erros} erro(s) em ${ev.total} questão(ões) somando as provas consideradas`,
  ];
  if (ev.provasComErro >= 2) {
    sinais.push(`erros distribuídos em ${ev.provasComErro} provas`);
  } else if (ev.provasComErro === 1 && ev.ocorrenciasPorProva[0]) {
    sinais.push(`nesta prova: ${ev.ocorrenciasPorProva[0].nome}`);
  }
  if (ev.acertos === 0 && ev.erros > 0) {
    sinais.push("ausência de acertos no escopo dentro da amostra");
  }
  if (isEscopoSomaAngulosFiguras(ev.escopoId, label)) {
    sinais.push("questões ligadas a relações angulares em figuras planas");
  } else if (ev.n3Recorrentes.length > 0) {
    sinais.push(`conhecimentos recorrentes: ${ev.n3Recorrentes.slice(0, 2).join("; ")}`);
  }
  return sinais;
}

function hipoteseConteudo(
  escopoId: string,
  label: string,
  ev?: EvidenciaCanonicaFoco
): {
  hipotese: string;
  objetivoDaSemana: string;
  motivoQuestRevisao: string;
  motivoQuestConceito: string;
  criterioConclusao: string;
} {
  if (isEscopoSomaAngulosFiguras(escopoId, label)) {
    const provasComErro = ev?.ocorrenciasPorProva.filter((o) => o.erros > 0) ?? [];
    const nomesProvas = provasComErro
      .map((o) => o.nome.split(" — ")[0]?.trim() || o.nome)
      .join(" e ");
    const refProvas = nomesProvas ? ` somando ${nomesProvas}` : " somando as provas consideradas";
    const refQuantidade =
      ev && ev.erros === ev.total
        ? `as ${ev.erros} questões`
        : `${ev?.erros ?? "as"} questão(ões)`;

    return {
      hipotese:
        "Os erros sugerem dificuldade em reconhecer qual relação angular deve ser usada antes do cálculo. A intervenção inicial deve testar se o problema está na leitura da figura, na identificação da relação e na montagem da equação.",
      objetivoDaSemana:
        "Reconhecer relações angulares em figuras planas e transformar a leitura da figura em uma equação simples.",
      motivoQuestRevisao: `Você errou ${refQuantidade} desse escopo${refProvas}. Refazer esses itens ajuda a localizar se o erro aconteceu na leitura da figura, na escolha da relação angular ou na montagem da equação.`,
      motivoQuestConceito:
        "Os erros sugerem que a base de reconhecimento das relações angulares precisa ser testada antes de novos exercícios. A tarefa reconstrói os casos essenciais que costumam aparecer em figuras planas.",
      criterioConclusao:
        "Concluir quando tiver refeito as questões indicadas com marcação da figura, relação angular escolhida, equação montada e uma frase dizendo onde o raciocínio quebrou.",
    };
  }

  return {
    hipotese:
      "Os erros sugerem dificuldade em aplicar o conteúdo do escopo com segurança. A intervenção inicial deve testar se o problema está no conceito, na interpretação do comando ou na execução.",
    objetivoDaSemana: `Observar onde o erro se concentra em ${label} — conceito, comando ou execução.`,
    motivoQuestRevisao:
      "Refazer os erros deste escopo ajuda a localizar em qual etapa da resolução o raciocínio quebrou.",
    motivoQuestConceito:
      "Antes de aumentar volume, vale reconstruir os casos-base que sustentam este escopo.",
    criterioConclusao:
      "Concluir quando tiver registrado o comando, o passo decisivo e uma frase sobre onde o raciocínio falhou.",
  };
}

export function inferirHipotesePedagogicaFoco(
  evidencia: EvidenciaCanonicaFoco,
  escopoLabel?: string
): HipotesePedagogicaFoco {
  const label = escopoLabel ?? evidencia.label;
  const forcaDaEvidencia = inferirForcaDaEvidencia(evidencia);
  const baselineEvidencia = formatarBaselineEvidenciaCiclo(evidencia);
  const sinais = montarSinais(evidencia, label);
  const conteudo = hipoteseConteudo(evidencia.escopoId, label, evidencia);

  const cuidadoInterpretativo =
    forcaDaEvidencia === "FORTE"
      ? "A evidência é consistente, mas ainda vale confirmar em nova prova antes de tratar como fragilidade global."
      : "A amostra ainda é pequena; a semana serve para testar a hipótese, não para concluir domínio ou fragilidade global.";

  const motivoParaAluno = `Esse tema apareceu como o sinal inicial mais consistente porque você errou ${evidencia.erros === evidencia.total && evidencia.total > 0 ? `as ${evidencia.total} questões` : `${evidencia.erros} questão(ões)`} desse escopo somando as provas consideradas. Como a amostra é ${forcaDaEvidencia === "INICIAL" ? "pequena" : "ainda limitada"}, a semana vai usar esse foco para investigar a hipótese pedagógica, não para fechar um diagnóstico definitivo.`;

  const motivoDiagnostico = motivoPrioridadeInicial(label, evidencia);

  const trabalhoSemana = isEscopoSomaAngulosFiguras(evidencia.escopoId, label)
    ? "leitura da figura, marcação dos ângulos, escolha da relação e montagem da equação"
    : "conceito, interpretação do comando e execução no escopo";

  const nucleoHipotese = isEscopoSomaAngulosFiguras(evidencia.escopoId, label)
    ? "a dificuldade esteja em reconhecer a relação angular correta na figura antes de fazer a conta"
    : "o erro esteja mais ligado ao conceito, à interpretação do comando ou à execução";

  const questoesRevisaoTexto = formatarQuestoesRevisaoPorProva(evidencia);

  const narrativaSemana =
    `A Semana 1 foca em ${label} para testar a hipótese de que ${nucleoHipotese}. ` +
    `Objetivo: ${conteudo.objetivoDaSemana} ` +
    `Evidência inicial: ${evidencia.erros} erro(s) em ${evidencia.total} questão(ões), somando as provas consideradas. ` +
    `O resultado será um sinal local; a confirmação real virá em nova prova ou simulado completo.`;

  const motivoSemana =
    `A Semana 1 vai focar em ${label} porque esse foi o sinal inicial mais consistente para intervenção: ${baselineEvidencia}. ` +
    `A hipótese é que ${nucleoHipotese}. ` +
    `Por isso, a semana vai trabalhar ${trabalhoSemana}. O resultado da semana será um sinal local; a confirmação real virá em nova prova ou simulado completo.`;

  const resumoPlano = isEscopoSomaAngulosFiguras(evidencia.escopoId, label)
    ? "Esta semana transforma a hipótese diagnóstica em duas tarefas práticas: refazer os erros com marcação da figura e reconstruir relações angulares essenciais. A meta é entender onde o raciocínio quebra, não provar domínio global."
    : `Esta semana transforma a hipótese diagnóstica em tarefas práticas no escopo ${label}. A meta é entender onde o raciocínio quebra, não provar domínio global.`;

  return {
    forcaDaEvidencia,
    hipotese: conteudo.hipotese,
    sinais,
    objetivoDaSemana: conteudo.objetivoDaSemana,
    cuidadoInterpretativo,
    motivoParaAluno,
    motivoDiagnostico,
    narrativaSemana,
    motivoSemana,
    resumoPlano,
    motivoQuest: conteudo.motivoQuestRevisao,
    criterioConclusao: conteudo.criterioConclusao,
    baselineEvidencia,
    questoesRevisaoTexto,
  };
}

/** Motivo específico para quest CONCEITO_BASE (não repete motivo de REVISAO_ERRO). */
export function motivoQuestConceitoBase(
  hipotese: HipotesePedagogicaFoco,
  escopoId: string,
  label: string
): string {
  if (isEscopoSomaAngulosFiguras(escopoId, label)) {
    return "Os erros sugerem que a base de reconhecimento das relações angulares precisa ser testada antes de novos exercícios. A tarefa reconstrói os casos essenciais que costumam aparecer em figuras planas.";
  }
  return hipotese.hipotese.replace(
    /^Os erros sugerem /,
    "Antes de novos exercícios, vale testar se "
  );
}
