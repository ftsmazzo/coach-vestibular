/**
 * Ciclo de Aprendizagem (semana): meta mensurável, prazo, baseline e agenda.
 * Abre/renova um ciclo na regeneração do plano e dá data (dueDate) às quests.
 */
import { prisma } from "@/lib/prisma";
import { buildDiagnosticoMotor } from "@/lib/diagnostic-motor";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";
import { isQuestCopiloto } from "@/lib/quests-alavanca";

const DIAS_CICLO = 7;

export type CicloBaseline = {
  clusterId: string | null;
  materia: string | null;
  pctMateria: number | null;
  erros: number;
  recorrencia: number;
  capturadoEm: string;
};

export async function getCicloAtivo(userId: string) {
  return prisma.learningCycle.findFirst({
    where: { userId, status: "ATIVO" },
    orderBy: { createdAt: "desc" },
  });
}

/** Abre um ciclo novo se não houver ativo ou se o ativo já venceu (fecha o antigo). */
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

  const motor = await buildDiagnosticoMotor(userId);
  const principal = motor.clusterPrincipal;
  const metaClusterId = principal?.clusterId ?? null;
  const metaMateria =
    principal?.materias[0]?.nome ?? motor.materiaDeficit?.label ?? null;
  const metaTitulo = principal
    ? CLUSTERS_PEDAGOGICOS[principal.clusterId].tituloHumano
    : metaMateria
      ? `Avançar em ${metaMateria}`
      : "Construir sua base de estudo";

  const baseline: CicloBaseline = {
    clusterId: metaClusterId,
    materia: metaMateria,
    pctMateria:
      motor.materiaDeficit?.pct ?? principal?.materias[0]?.pctAcerto ?? null,
    erros: principal?.erros ?? 0,
    recorrencia: principal?.recorrencia ?? 0,
    capturadoEm: agora.toISOString(),
  };

  const endAt = new Date(agora);
  endAt.setDate(endAt.getDate() + DIAS_CICLO);

  return prisma.learningCycle.create({
    data: {
      userId,
      indice: proxIndice,
      status: "ATIVO",
      startAt: agora,
      endAt,
      metaClusterId,
      metaMateria,
      metaTitulo,
      baselineJson: JSON.stringify(baseline),
    },
  });
}

/** Vincula as quests da jornada (copiloto) ao ciclo e espalha o dueDate pelos dias. */
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

/** Chamado na regeneração do plano: garante o ciclo da semana e agenda as quests. */
export async function sincronizarCicloDaSemana(userId: string) {
  const ciclo = await abrirOuRenovarCiclo(userId);
  await vincularQuestsAoCiclo(userId, ciclo);
  return ciclo;
}

export type CicloResumo = {
  id: string;
  indice: number;
  metaTitulo: string;
  metaMateria: string | null;
  endAt: string;
  diasRestantes: number;
  expirado: boolean;
  total: number;
  feitas: number;
  pendentes: number;
  pctConcluido: number;
};

/** Resumo do ciclo ativo para a UI (Home/Plano/Quests). Null se não houver. */
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

  return {
    id: ciclo.id,
    indice: ciclo.indice,
    metaTitulo: ciclo.metaTitulo,
    metaMateria: ciclo.metaMateria,
    endAt: ciclo.endAt.toISOString(),
    diasRestantes,
    expirado: ciclo.endAt.getTime() <= agora,
    total,
    feitas,
    pendentes,
    pctConcluido: total > 0 ? Math.round((feitas / total) * 100) : 0,
  };
}
