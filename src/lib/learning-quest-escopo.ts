/**
 * Quests dirigidas por escopo N2 — passos concretos por estratégia de intervenção.
 */
import type { FocoPedagogico, EstrategiaIntervencao } from "@/lib/diagnosis-escopo";
import { formatarPassos } from "@/lib/copiloto-passos";

export type QuestEscopoDirigida = {
  chave: string;
  titulo: string;
  descricao: string;
  materiaId: string;
  conhecimentoEscopoId: string;
  conhecimentoDominioId: string;
  conceitosCanonicosJson?: string;
  fonteDiagnosticoJson: string;
  tipoQuest: string;
  duracaoMin: number;
  ordem: number;
  rotulo: string;
};

const ROTULOS_ESTRATEGIA: Record<EstrategiaIntervencao, string> = {
  revisao_conceitual: "Fechar base conceitual",
  modelagem_guiada: "Modelar antes de resolver",
  engenharia_reversa: "Destrinchar o erro",
  treino_cronometrado: "Bloco cronometrado",
  comparacao_de_conceitos: "Diferenciar conceitos",
  refazer_erro: "Refazer com atenção",
  mini_simulado_dirigido: "Mini-bloco dirigido",
  metacognicao: "Critério de escolha",
};

function passosPorEstrategia(
  fp: FocoPedagogico,
  estrategia: EstrategiaIntervencao
): string[] {
  const nums = fp.numerosErrados.slice(0, 5);
  const refNums = nums.length ? `questões ${nums.join(", ")}` : "questões que você errou";
  const escopo = `${fp.escopoLabel} (${fp.materiaLabel})`;
  const conceito =
    fp.conhecimentoExigido[0] ??
    fp.conceitosCanonicos[0] ??
    fp.escopoLabel;

  const base: Record<EstrategiaIntervencao, string[]> = {
    revisao_conceitual: [
      `Abra o material de ${fp.materiaLabel} no tópico: ${conceito}.`,
      "Faça um fichamento de 5 linhas — só o que cai em prova.",
      `Refaça as ${refNums} com gabarito comentado.`,
      "Resolva 3 questões novas do mesmo escopo (sem dispersar).",
    ],
    modelagem_guiada: [
      `Escopo: ${escopo}. Antes de calcular, desenhe o esquema ou modelo.`,
      `Nas ${refNums}, identifique o comando do enunciado e o dado-chave.`,
      "Monte o passo a passo em tópicos antes de marcar a alternativa.",
      "Refaça 2 questões parecidas aplicando o mesmo modelo.",
    ],
    engenharia_reversa: [
      `Pegue as ${refNums} — resolva com gabarito comentado.`,
      "Marque o ponto exato em que a lógica bifurcou (onde você errou).",
      "Escreva em 1 frase por questão: o que faltou saber ou interpretar.",
      "Faça 2 questões novas e pare antes de marcar — confira o critério.",
    ],
    treino_cronometrado: [
      `Separe 8 questões de ${escopo} (incluindo ${refNums}).`,
      "Cronometre 12 minutos — sublinhe o comando de cada enunciado.",
      "Corrija na hora; anote se foi pressa, conta ou interpretação.",
      "Repita só as que errou, sem cronômetro, com calma.",
    ],
    comparacao_de_conceitos: [
      `Liste 2 conceitos próximos em ${escopo} que você confunde.`,
      "Para cada um, escreva 1 diferença decisiva (quando usar cada um).",
      `Refaça as ${refNums} explicando por que a alternativa certa é certa.`,
      "Resolva 3 questões que exigem comparar os dois conceitos.",
    ],
    refazer_erro: [
      `Refaça as ${refNums} do zero — sem olhar a resolução primeiro.`,
      "Confira cada passo aritmético ou lógico antes de marcar.",
      "Se errar de novo, anote em qual linha/passo travou.",
      "Faça 3 questões curtas do mesmo escopo só para consolidar execução.",
    ],
    mini_simulado_dirigido: [
      `Monte um bloco de 6 questões só de ${escopo}.`,
      `Inclua pelo menos uma parecida com a questão ${nums[0] ?? "que você errou"}.`,
      "Faça sem consultar material; corrija em seguida.",
      "Anote quantas foram conteúdo vs. interpretação vs. pressa.",
    ],
    metacognicao: [
      `Nas ${refNums}, escreva: entre quais alternativas você ficou?`,
      "Para cada dúvida, qual critério teria eliminado a errada?",
      "Refaça 3 questões marcando o critério antes de escolher.",
      "No fim, resuma seu padrão de dúvida em 1 frase.",
    ],
  };

  return base[estrategia];
}

export function tituloQuestEscopo(fp: FocoPedagogico): string {
  const verbo = ROTULOS_ESTRATEGIA[fp.estrategiaRecomendada];
  return `${fp.materiaLabel} — ${verbo}: ${fp.escopoLabel}`;
}

export function montarQuestEscopoDirigida(
  fp: FocoPedagogico,
  ordem: number,
  rotulo: string,
  chaveQuest: (tipo: "escopo" | "padrao" | "materia" | "anamnese" | "ia", id: string) => string
): QuestEscopoDirigida {
  const passos = passosPorEstrategia(fp, fp.estrategiaRecomendada);
  const duracao =
    fp.prioridade === "alta"
      ? fp.estrategiaRecomendada === "treino_cronometrado"
        ? 25
        : 45
      : 35;

  const porQue =
    fp.metadadosCognitivosResumo?.resumoTexto &&
    fp.metadadosCognitivosResumo.resumoTexto !== "Sem metadados detalhados"
      ? fp.metadadosCognitivosResumo.resumoTexto
      : fp.hipoteseCausa;

  return {
    chave: chaveQuest("escopo", `${fp.escopoId}-${fp.estrategiaRecomendada}`),
    titulo: tituloQuestEscopo(fp),
    descricao: formatarPassos(
      passos,
      `${rotulo.toLowerCase()} — ${fp.objetivoDaSemana} (${porQue})`,
      duracao
    ),
    materiaId: fp.materiaId,
    conhecimentoEscopoId: fp.escopoId,
    conhecimentoDominioId: fp.dominioId,
    conceitosCanonicosJson:
      fp.conceitosCanonicos.length > 0
        ? JSON.stringify(fp.conceitosCanonicos)
        : undefined,
    fonteDiagnosticoJson: JSON.stringify({
      focoId: fp.focoId,
      escopoId: fp.escopoId,
      estrategia: fp.estrategiaRecomendada,
      numerosErrados: fp.numerosErrados,
    }),
    tipoQuest: fp.estrategiaRecomendada,
    duracaoMin: duracao,
    ordem,
    rotulo,
  };
}
