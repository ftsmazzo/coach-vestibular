/**
 * Cobertura N2 — indica se o motor v1 pode operar (escopos classificados).
 * Consumidores de diagnóstico/plano devem checar antes de prometer copiloto por escopo.
 */
import { prisma } from "@/lib/prisma";
import { idFallbackNaoClassificado } from "@/lib/conhecimento-catalog/load";

export type CoberturaN2 = {
  totalErros: number;
  comEscopoN2: number;
  pctCobertura: number;
  motorOperacional: boolean;
};

function escopoValido(escopoId: string | null | undefined, materiaId?: string | null): boolean {
  if (!escopoId?.trim()) return false;
  if (escopoId.includes("__nao_classificado")) return false;
  if (materiaId && escopoId === idFallbackNaoClassificado(materiaId)) return false;
  return true;
}

/** % de tentativas erradas recentes com conhecimentoEscopoId válido (N2). */
export async function getCoberturaN2(
  userId: string,
  opts?: { takeExams?: number }
): Promise<CoberturaN2> {
  const take = opts?.takeExams ?? 12;
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      exam: { userId },
      correto: false,
    },
    orderBy: { exam: { data: "desc" } },
    take: take * 80,
    select: {
      conhecimentoEscopoId: true,
      conhecimentoDominioId: true,
      provaQuestao: {
        select: {
          conhecimentoEscopoId: true,
          conhecimentoDominioId: true,
          materia: true,
        },
      },
    },
  });

  let totalErros = 0;
  let comEscopoN2 = 0;

  for (const a of attempts) {
    totalErros++;
    const escopoId = a.conhecimentoEscopoId ?? a.provaQuestao?.conhecimentoEscopoId;
    const dominioId = a.conhecimentoDominioId ?? a.provaQuestao?.conhecimentoDominioId;
    const materiaId = dominioId?.split(".")[0] ?? a.provaQuestao?.materia?.toLowerCase();
    if (escopoValido(escopoId, materiaId)) comEscopoN2++;
  }

  const pctCobertura =
    totalErros > 0 ? Math.round((comEscopoN2 / totalErros) * 100) : 0;

  return {
    totalErros,
    comEscopoN2,
    pctCobertura,
    motorOperacional: totalErros >= 3 && pctCobertura >= 40,
  };
}
