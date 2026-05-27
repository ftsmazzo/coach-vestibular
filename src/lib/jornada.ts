import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { labelModoUso, OPCOES_MODO_USO, pesoModoUso } from "@/lib/modo-uso";
import {
  bancasPrioritariasDaMeta,
  pesoBancaParaMeta,
  textoMetaAluno,
} from "@/lib/meta-vestibular";
import { getMateriaLabel } from "@/lib/taxonomy";

export interface ResumoJornada {
  totalRegistros: number;
  totalQuestoes: number;
  acertos: number;
  erros: number;
  pctAcertoPonderado: number;
  porModoUso: Array<{
    modoUso: ModoUsoRegistro;
    label: string;
    registros: number;
    pctAcerto: number;
    peso: number;
  }>;
  porMateria: Array<{
    materiaId: string;
    label: string;
    erros: number;
    total: number;
    pesoErros: number;
  }>;
  xp: number;
  metaAlvo: string;
  bancasPrioritarias: string[];
}

export async function buildResumoJornada(userId: string): Promise<ResumoJornada> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, metaProva: true, vestibularAlvo: true },
  });

  const metaAlvo = textoMetaAluno(user?.metaProva, user?.vestibularAlvo);
  const bancasPrioritarias = bancasPrioritariasDaMeta(
    user?.metaProva,
    user?.vestibularAlvo
  );

  const exams = await prisma.exam.findMany({
    where: { userId },
    include: { questionAttempts: true },
    orderBy: { data: "desc" },
  });

  let acertos = 0;
  let erros = 0;
  let somaPesoAcerto = 0;
  let somaPeso = 0;

  const porModo = new Map<
    ModoUsoRegistro,
    { registros: number; acertos: number; total: number }
  >();

  const materiaMap = new Map<
    string,
    { erros: number; total: number; pesoErros: number }
  >();

  for (const exam of exams) {
    const peso =
      pesoModoUso(exam.modoUso) *
      pesoBancaParaMeta(exam.banca, user?.metaProva, user?.vestibularAlvo);
    const modoStats = porModo.get(exam.modoUso) ?? { registros: 0, acertos: 0, total: 0 };
    modoStats.registros++;
    porModo.set(exam.modoUso, modoStats);

    for (const q of exam.questionAttempts) {
      const totalQ = exam.questionAttempts.length;
      if (totalQ === 0) continue;

      if (q.correto) {
        acertos++;
        modoStats.acertos++;
      } else {
        erros++;
      }
      modoStats.total++;

      somaPesoAcerto += (q.correto ? 1 : 0) * peso;
      somaPeso += peso;

      if (!q.correto && q.materiaId) {
        const m = materiaMap.get(q.materiaId) ?? { erros: 0, total: 0, pesoErros: 0 };
        m.erros++;
        m.total++;
        m.pesoErros += peso;
        materiaMap.set(q.materiaId, m);
      } else if (q.materiaId) {
        const m = materiaMap.get(q.materiaId) ?? { erros: 0, total: 0, pesoErros: 0 };
        m.total++;
        materiaMap.set(q.materiaId, m);
      }
    }
  }

  const porModoUso = OPCOES_MODO_USO.flatMap((modo) => {
    const s = porModo.get(modo);
    if (!s || s.registros === 0) return [];
    return [
      {
        modoUso: modo,
        label: labelModoUso(modo),
        registros: s.registros,
        pctAcerto: s.total > 0 ? Math.round((s.acertos / s.total) * 100) : 0,
        peso: pesoModoUso(modo),
      },
    ];
  });

  const porMateria = [...materiaMap.entries()]
    .map(([materiaId, s]) => ({
      materiaId,
      label: getMateriaLabel(materiaId),
      erros: s.erros,
      total: s.total,
      pesoErros: Math.round(s.pesoErros * 10) / 10,
    }))
    .sort((a, b) => b.pesoErros - a.pesoErros)
    .slice(0, 8);

  const totalQuestoes = acertos + erros;

  return {
    totalRegistros: exams.length,
    totalQuestoes,
    acertos,
    erros,
    pctAcertoPonderado: somaPeso > 0 ? Math.round((somaPesoAcerto / somaPeso) * 100) : 0,
    porModoUso,
    porMateria,
    xp: user?.xp ?? 0,
    metaAlvo,
    bancasPrioritarias,
  };
}
