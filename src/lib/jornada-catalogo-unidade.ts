import type { QuestaoCatalogoClassificacao } from "@/lib/jornada-classificacao-attempt";
import {
  inferirDiaMultidia,
  normalizarNumeroMultidia,
  type ExamParaAgrupamento,
  type ProvaMultidiaMeta,
  type UnidadeRegistroJornada,
} from "@/lib/prova-multidia";

export type ProvaComQuestoesJornada = ProvaMultidiaMeta & {
  nome?: string;
  questoes?: (QuestaoCatalogoClassificacao & { numero: number })[];
};

function provaComDiaEfetivo(prova: ProvaMultidiaMeta, numeros: number[]): ProvaMultidiaMeta {
  const dia = inferirDiaMultidia(prova, numeros);
  return dia != null ? { ...prova, dia } : prova;
}

export function catalogoQuestoesUnidadeJornada(
  unidade: UnidadeRegistroJornada<ExamParaAgrupamento>
): Map<number, QuestaoCatalogoClassificacao> {
  const map = new Map<number, QuestaoCatalogoClassificacao>();

  for (const exam of unidade.exames) {
    const prova = exam.prova as ProvaComQuestoesJornada | null | undefined;
    const questoes = prova?.questoes;
    if (!prova || !questoes?.length) continue;

    if (unidade.conjuntoMultidia) {
      const p = provaComDiaEfetivo(prova, exam.questionAttempts.map((a) => a.numero));
      for (const q of questoes) {
        map.set(normalizarNumeroMultidia(q.numero, p), q);
      }
    } else {
      for (const q of questoes) map.set(q.numero, q);
    }
  }

  return map;
}

export function nomeProvaUnidadeJornada(unidade: UnidadeRegistroJornada<ExamParaAgrupamento>): string {
  const prova = unidade.exames[0]?.prova as ProvaComQuestoesJornada | null | undefined;
  return prova?.nome ?? unidade.nome;
}
