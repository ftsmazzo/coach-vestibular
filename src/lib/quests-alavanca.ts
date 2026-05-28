import type { JourneyInsight } from "@/lib/journey-insight";
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

  for (const c of insight.clustersCognitivos.slice(0, 2)) {
    desejadas.push({
      chave: chaveQuest("conhecimento", `cluster-${c.tipo}`),
      titulo: `${PREFIXO_QUEST_ALAVANCA}${c.label}: prática guiada`,
      descricao:
        `Treinar ${c.verboTreino}. ${c.erros} erro${c.erros !== 1 ? "s" : ""} na jornada` +
        (c.materias[0] ? ` (contexto: ${c.materias[0]})` : "") +
        `. Ex.: ${c.exemplosConhecimento[0] ?? "revisar questões erradas"}.`,
      duracaoMin: 45,
    });
  }

  for (const l of insight.lacunasConhecimento.slice(0, 1)) {
    desejadas.push({
      chave: chaveQuest("conhecimento", l.chave),
      titulo: `${PREFIXO_QUEST_ALAVANCA}${l.tipoCognitivoLabel}: ${l.texto.slice(0, 40)}${l.texto.length > 40 ? "…" : ""}`,
      descricao:
        `Conhecimento exigido que você errou ${l.erros} vez${l.erros !== 1 ? "es" : ""}. ` +
        `Releia teoria, refaça 12 questões parecidas e anote uma regra no caderno.` +
        (l.materia ? ` Contexto: ${l.materia}.` : ""),
      duracaoMin: 40,
    });
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
