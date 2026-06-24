import { n1Completo, parseClassificacaoN1 } from "@/lib/classificacao-n1-types";

/** Estatísticas N1/N2/N3 — safe para client components (sem Prisma). */
export function statsFasesProva(questoes: Array<{
  classificacaoN1Json?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
}>) {
  let comN1 = 0;
  let comN2Real = 0;
  let comN2Fallback = 0;
  let comN3 = 0;

  for (const q of questoes) {
    if (n1Completo(parseClassificacaoN1(q.classificacaoN1Json))) comN1++;
    const esc = q.conhecimentoEscopoId?.trim();
    if (esc) {
      if (esc.endsWith(".__nao_classificado")) comN2Fallback++;
      else comN2Real++;
    }
    if (q.conhecimentoExigido?.trim()) comN3++;
  }

  return { comN1, comN2Real, comN2Fallback, comN3, total: questoes.length };
}
