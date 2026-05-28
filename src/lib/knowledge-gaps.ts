import { prisma } from "@/lib/prisma";
import { pesoModoUso } from "@/lib/modo-uso";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import {
  agruparPorTipoCognitivo,
  inferirTipoCognitivo,
  type ClusterCognitivo,
  type TipoCognitivoId,
} from "@/lib/tipo-cognitivo";

export type LacunaConhecimento = {
  chave: string;
  texto: string;
  materia: string | null;
  tipoCognitivo: TipoCognitivoId;
  tipoCognitivoLabel: string;
  erros: number;
  errosPonderados: number;
  numeros: number[];
};

export type { ClusterCognitivo };

function normalizarConhecimento(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

/** Lacunas por conhecimento exigido (erros na jornada) — sem depender só de matéria/assunto. */
export async function aggregateKnowledgeGaps(
  userId: string,
  limit = 6
): Promise<LacunaConhecimento[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metaProva: true, vestibularAlvo: true },
  });

  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take: 14,
    select: {
      modoUso: true,
      banca: true,
      questionAttempts: {
        where: { correto: false },
        select: {
          numero: true,
          provaQuestao: {
            select: { conhecimentoExigido: true, materia: true },
          },
        },
      },
    },
  });

  const map = new Map<string, LacunaConhecimento>();

  for (const exam of exams) {
    const peso =
      pesoModoUso(exam.modoUso) *
      pesoBancaParaMeta(exam.banca, user?.metaProva, user?.vestibularAlvo);

    for (const a of exam.questionAttempts) {
      const raw = a.provaQuestao?.conhecimentoExigido?.trim();
      if (!raw || raw.length < 8) continue;

      const chave = normalizarConhecimento(raw);
      const tipo = inferirTipoCognitivo(raw);
      const entry =
        map.get(chave) ??
        ({
          chave,
          texto: raw.length > 160 ? `${raw.slice(0, 157)}…` : raw,
          materia: a.provaQuestao?.materia?.trim() || null,
          tipoCognitivo: tipo.id,
          tipoCognitivoLabel: tipo.label,
          erros: 0,
          errosPonderados: 0,
          numeros: [],
        } satisfies LacunaConhecimento);

      entry.erros += 1;
      entry.errosPonderados += peso;
      if (a.numero && !entry.numeros.includes(a.numero) && entry.numeros.length < 6) {
        entry.numeros.push(a.numero);
      }
      map.set(chave, entry);
    }
  }

  return [...map.values()]
    .sort((a, b) => b.errosPonderados - a.errosPonderados || b.erros - a.erros)
    .slice(0, limit);
}

/** Agrupa lacunas por operação cognitiva inferida. */
export async function aggregateCognitiveClusters(
  userId: string,
  limit = 4
): Promise<ClusterCognitivo[]> {
  const lacunas = await aggregateKnowledgeGaps(userId, 24);
  return agruparPorTipoCognitivo(lacunas).slice(0, limit);
}
