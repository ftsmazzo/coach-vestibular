/**
 * Ciclo de Aprendizagem (semana): meta mensurável, prazo, baseline e agenda.
 * Só abre ciclo quando há foco por escopo N2.
 */
import { prisma } from "@/lib/prisma";
import { isQuestCopiloto } from "@/lib/quests-alavanca";
import {
  baselineCicloFromFoco,
  getFocoPedagogicoPrincipal,
} from "@/lib/learning-motor-foco";
import { buildStorytellingFechamento } from "@/lib/learning-storytelling";

const DIAS_CICLO = 7;

export type CicloBaseline = {
  escopoId: string | null;
  materia: string | null;
  pctEscopo: number | null;
  erros: number;
  recorrencia: number;
  capturadoEm: string;
  focos?: Array<{ taxaAcerto?: number; escopoId?: string }>;
};

export async function getCicloAtivo(userId: string) {
  return prisma.learningCycle.findFirst({
    where: { userId, status: "ATIVO" },
    orderBy: { createdAt: "desc" },
  });
}

/** Abre um ciclo novo se não houver ativo ou se o ativo já venceu. Sem foco escopo → null. */
export async function abrirOuRenovarCiclo(userId: string) {
  const agora = new Date();
  const ativo = await getCicloAtivo(userId);
  if (ativo && ativo.endAt > agora) return ativo;

  let proxIndice = 1;
  if (ativo) {
    await prisma.learningCycle.update({
      where: { id: ativo.id },
      data: { status: "FECHADO", fechadoEm: agora },
    });
    proxIndice = ativo.indice + 1;
  } else {
    proxIndice = (await prisma.learningCycle.count({ where: { userId } })) + 1;
  }

  const focoEscopo = await getFocoPedagogicoPrincipal(userId);
  if (!focoEscopo) return null;

  const baseline = baselineCicloFromFoco(focoEscopo);
  const endAt = new Date(agora);
  endAt.setDate(endAt.getDate() + DIAS_CICLO);

  return prisma.learningCycle.create({
    data: {
      userId,
      indice: proxIndice,
      status: "ATIVO",
      startAt: agora,
      endAt,
      metaEscopoId: focoEscopo.escopoId,
      metaDominioId: focoEscopo.dominioId,
      metaMateria: focoEscopo.materiaLabel,
      metaConceitosJson: JSON.stringify(focoEscopo.conceitosCanonicos),
      metaCognitivaJson: focoEscopo.metadadosCognitivosResumo
        ? JSON.stringify(focoEscopo.metadadosCognitivosResumo)
        : null,
      metaTitulo: `Dominar: ${focoEscopo.escopoLabel}`,
      baselineJson: JSON.stringify(baseline),
      narrativaInicioJson: JSON.stringify({
        hipotese: focoEscopo.hipoteseCausa,
        objetivo: focoEscopo.objetivoDaSemana,
        estrategia: focoEscopo.estrategiaRecomendada,
      }),
    },
  });
}

export async function vincularQuestsAoCiclo(
  userId: string,
  ciclo: { id: string; startAt: Date }
) {
  const pendentes = await prisma.quest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  const copiloto = pendentes.filter((q) => isQuestCopiloto(q));

  for (let i = 0; i < copiloto.length; i++) {
    const due = new Date(ciclo.startAt);
    due.setDate(due.getDate() + Math.min(DIAS_CICLO - 1, i * 2 + 1));
    await prisma.quest.update({
      where: { id: copiloto[i]!.id },
      data: { cicloId: ciclo.id, dueDate: due },
    });
  }
}

export async function sincronizarCicloDaSemana(userId: string) {
  const ciclo = await abrirOuRenovarCiclo(userId);
  if (ciclo) await vincularQuestsAoCiclo(userId, ciclo);
  return ciclo;
}

export type CicloResultado = {
  quizPct: number | null;
  baselinePct: number | null;
  deltaPct: number | null;
  totalQuests: number;
  feitas: number;
  fechadoEm: string;
};

export async function fecharCiclo(
  userId: string,
  opts?: { quizPct?: number | null; quizAcertos?: number; quizTotal?: number }
): Promise<{ resultado: CicloResultado; proximo: Awaited<ReturnType<typeof abrirOuRenovarCiclo>> } | null> {
  const ativo = await getCicloAtivo(userId);
  if (!ativo) return null;

  const [total, feitas] = await Promise.all([
    prisma.quest.count({ where: { userId, cicloId: ativo.id } }),
    prisma.quest.count({ where: { userId, cicloId: ativo.id, status: "done" } }),
  ]);

  let baselinePct: number | null = null;
  if (ativo.baselineJson) {
    try {
      const bl = JSON.parse(ativo.baselineJson) as CicloBaseline;
      baselinePct =
        bl.focos?.[0]?.taxaAcerto != null
          ? Math.round(bl.focos[0].taxaAcerto * 100)
          : bl.pctEscopo ?? null;
    } catch {
      baselinePct = null;
    }
  }

  const quizPct = opts?.quizPct ?? null;
  const quizAcertos = opts?.quizAcertos ?? 0;
  const quizTotal = opts?.quizTotal ?? 0;

  const { storytelling, resultado: resultadoMotor, narrativaFim } =
    buildStorytellingFechamento(
      ativo,
      quizPct,
      quizAcertos,
      quizTotal,
      feitas,
      total
    );

  const resultado: CicloResultado = {
    quizPct,
    baselinePct,
    deltaPct: quizPct != null && baselinePct != null ? quizPct - baselinePct : null,
    totalQuests: total,
    feitas,
    fechadoEm: new Date().toISOString(),
  };

  await prisma.learningCycle.update({
    where: { id: ativo.id },
    data: {
      status: "FECHADO",
      fechadoEm: new Date(),
      resultadoJson: JSON.stringify({ ...resultadoMotor, legado: resultado }),
      storytellingJson: JSON.stringify(storytelling),
      narrativaFimJson: JSON.stringify({ texto: narrativaFim }),
    },
  });

  const proximo = await abrirOuRenovarCiclo(userId);
  return { resultado, proximo };
}

export type CicloResumo = {
  id: string;
  indice: number;
  metaTitulo: string;
  metaMateria: string | null;
  metaEscopoId: string | null;
  endAt: string;
  diasRestantes: number;
  expirado: boolean;
  total: number;
  feitas: number;
  pendentes: number;
  pctConcluido: number;
  historiaInicio?: string[];
};

export type CicloFechadoView = {
  indice: number;
  metaTitulo: string;
  metaMateria: string | null;
  metaEscopoId: string | null;
  quizPct: number | null;
  baselinePct: number | null;
  deltaPct: number | null;
  feitas: number;
  totalQuests: number;
  fechadoEm: string | null;
  historia?: string[];
  proximoPasso?: string;
};

export async function getCiclosFechados(
  userId: string,
  limit = 8
): Promise<CicloFechadoView[]> {
  const ciclos = await prisma.learningCycle.findMany({
    where: { userId, status: "FECHADO" },
    orderBy: { fechadoEm: "desc" },
    take: limit,
  });

  return ciclos.map((c) => {
    let r: Partial<CicloResultado> = {};
    let historia: string[] | undefined;
    let proximoPasso: string | undefined;

    if (c.resultadoJson) {
      try {
        const parsed = JSON.parse(c.resultadoJson) as CicloResultado & {
          legado?: CicloResultado;
          avaliacao?: { pctAcerto?: number };
        };
        r = parsed.legado ?? parsed;
        if (parsed.avaliacao?.pctAcerto != null && r.quizPct == null) {
          r.quizPct = parsed.avaliacao.pctAcerto;
        }
      } catch {
        r = {};
      }
    }

    if (c.storytellingJson) {
      try {
        const story = JSON.parse(c.storytellingJson) as {
          paragrafos?: string[];
          proximoPasso?: string;
        };
        historia = story.paragrafos;
        proximoPasso = story.proximoPasso;
      } catch {
        /* ignora */
      }
    }

    return {
      indice: c.indice,
      metaTitulo: c.metaTitulo,
      metaMateria: c.metaMateria,
      metaEscopoId: c.metaEscopoId,
      quizPct: r.quizPct ?? null,
      baselinePct: r.baselinePct ?? null,
      deltaPct: r.deltaPct ?? null,
      feitas: r.feitas ?? 0,
      totalQuests: r.totalQuests ?? 0,
      fechadoEm: c.fechadoEm?.toISOString() ?? null,
      historia,
      proximoPasso,
    };
  });
}

export async function getUltimoCicloFechado(
  userId: string
): Promise<CicloFechadoView | null> {
  const [c] = await getCiclosFechados(userId, 1);
  return c ?? null;
}

export async function getCicloResumo(userId: string): Promise<CicloResumo | null> {
  const ciclo = await getCicloAtivo(userId);
  if (!ciclo) return null;

  const [total, feitas, pendentes] = await Promise.all([
    prisma.quest.count({ where: { userId, cicloId: ciclo.id } }),
    prisma.quest.count({ where: { userId, cicloId: ciclo.id, status: "done" } }),
    prisma.quest.count({ where: { userId, cicloId: ciclo.id, status: "pending" } }),
  ]);

  const agora = Date.now();
  const diasRestantes = Math.max(
    0,
    Math.ceil((ciclo.endAt.getTime() - agora) / 86_400_000)
  );

  let historiaInicio: string[] | undefined;
  if (ciclo.narrativaInicioJson || ciclo.baselineJson) {
    const { buildCicloInicioStory } = await import("@/lib/learning-storytelling");
    let narrativaInicio: { hipotese?: string; objetivo?: string } | null = null;
    if (ciclo.narrativaInicioJson) {
      try {
        narrativaInicio = JSON.parse(ciclo.narrativaInicioJson);
      } catch {
        narrativaInicio = null;
      }
    }
    historiaInicio = buildCicloInicioStory(ciclo, narrativaInicio).paragrafos;
  }

  return {
    id: ciclo.id,
    indice: ciclo.indice,
    metaTitulo: ciclo.metaTitulo,
    metaMateria: ciclo.metaMateria,
    metaEscopoId: ciclo.metaEscopoId,
    endAt: ciclo.endAt.toISOString(),
    diasRestantes,
    expirado: ciclo.endAt.getTime() <= agora,
    total,
    feitas,
    pendentes,
    pctConcluido: total > 0 ? Math.round((feitas / total) * 100) : 0,
    historiaInicio,
  };
}
