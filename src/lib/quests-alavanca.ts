import type { JourneyInsight } from "@/lib/journey-insight";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";
import { prisma } from "@/lib/prisma";

export const PREFIXO_QUEST_ALAVANCA = "[Alavanca] ";

function chaveQuest(tipo: "materia" | "conhecimento", id: string) {
  return `${tipo}:${id}`;
}

/** Sincroniza quests extras ligadas às alavancas/lacunas da Home (não substituem o plano semanal). */
export async function garantirQuestsAlavanca(
  userId: string,
  insight: JourneyInsight
): Promise<void> {
  if (!insight.temDados) return;

  const desejadas: Array<{
    chave: string;
    titulo: string;
    descricao: string;
    materiaId?: string;
    duracaoMin: number;
  }> = [];

  for (const a of insight.alavancas.filter((x) => x.potencial === "alto").slice(0, 1)) {
    desejadas.push({
      chave: chaveQuest("materia", a.materiaId),
      titulo: `${PREFIXO_QUEST_ALAVANCA}Reforço: ${a.label}`,
      descricao:
        `${a.mensagem} Faça teoria + 15 questões focadas. ` +
        `Hoje você está com ${a.pctAcerto}% de acerto ponderado nesta matéria na jornada.`,
      materiaId: a.materiaId,
      duracaoMin: 45,
    });
  }

  const clusterTop = insight.clustersPedagogicos[0];
  if (clusterTop) {
    const def = CLUSTERS_PEDAGOGICOS[clusterTop.clusterId];
    const mat = clusterTop.materias[0]?.nome ?? insight.principalGargalo?.materiaDeficitPrincipal;
    desejadas.push({
      chave: chaveQuest("conhecimento", `cluster-${clusterTop.clusterId}`),
      titulo: `${PREFIXO_QUEST_ALAVANCA}${def.tituloHumano}`,
      descricao:
        `${def.proximoPassoSemana} ` +
        (mat ? `Prioridade em ${mat} (soma das provas da sua jornada, não só a última). ` : "") +
        (clusterTop.evidencias[0]
          ? `Lembre de questões como: ${clusterTop.evidencias[0].slice(0, 100)}.`
          : ""),
      duracaoMin: 50,
    });
  } else {
    const lacunaTop = insight.lacunasConhecimento[0];
    if (lacunaTop) {
      desejadas.push({
        chave: chaveQuest("conhecimento", `prio-${lacunaTop.chave}`),
        titulo: `${PREFIXO_QUEST_ALAVANCA}${lacunaTop.tipoCognitivoLabel}: prática focada`,
        descricao:
          `${lacunaTop.texto} ` +
          (lacunaTop.causaDominante
            ? `Causa mais marcada: ${lacunaTop.causaDominante.label}. `
            : "") +
          (lacunaTop.materia ? `Contexto: ${lacunaTop.materia}. ` : "") +
          "20 min teoria + 15 questões parecidas + anotar regra no caderno.",
        duracaoMin: 50,
      });
    }
  }


  if (desejadas.length === 0) return;

  const chavesDesejadas = new Set(desejadas.map((d) => d.chave));

  const pendentesAlavanca = await prisma.quest.findMany({
    where: {
      userId,
      status: "pending",
      titulo: { startsWith: PREFIXO_QUEST_ALAVANCA },
    },
  });

  for (const q of pendentesAlavanca) {
    const chaveAtual = extrairChaveQuest(q.descricao ?? "");
    if (!chaveAtual || !chavesDesejadas.has(chaveAtual)) {
      await prisma.quest.update({
        where: { id: q.id },
        data: { status: "skipped" },
      });
    }
  }

  const existentesChaves = new Set(
    pendentesAlavanca
      .map((q) => extrairChaveQuest(q.descricao ?? ""))
      .filter((c): c is string => Boolean(c))
  );

  const criar = desejadas.filter((d) => !existentesChaves.has(d.chave));
  if (criar.length === 0) return;

  await prisma.quest.createMany({
    data: criar.map((d) => ({
      userId,
      titulo: d.titulo,
      descricao: `<!-- ${d.chave} -->\n${d.descricao}`,
      materiaId: d.materiaId,
      duracaoMin: d.duracaoMin,
      rewardMsg: "Fechar uma lacuna real pesa mais que acertar por sorte na próxima prova.",
    })),
  });
}

function extrairChaveQuest(descricao: string): string | null {
  const m = descricao.match(/^<!--\s*(\S+)\s*-->/);
  return m?.[1] ?? null;
}

export function isQuestAlavanca(titulo: string) {
  return titulo.startsWith(PREFIXO_QUEST_ALAVANCA);
}

export function limparDescricaoQuest(descricao: string | null): string {
  if (!descricao) return "";
  return descricao.replace(/^<!--\s*\S+\s*-->\n?/, "").trim();
}

export async function getQuestsAlavancaPendentes(userId: string) {
  const todas = await prisma.quest.findMany({
    where: {
      userId,
      status: "pending",
      titulo: { startsWith: PREFIXO_QUEST_ALAVANCA },
    },
    orderBy: { createdAt: "desc" },
  });
  return todas.map((q) => ({
    ...q,
    descricao: limparDescricaoQuest(q.descricao),
  }));
}
