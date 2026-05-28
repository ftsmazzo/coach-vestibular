import type { JourneyInsight } from "@/lib/journey-insight";
import type { AlavancaJornada } from "@/lib/journey-insight";
import { formatarPassos, PASSOS_POR_CLUSTER } from "@/lib/copiloto-passos";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";
import type { ClusterAgregado } from "@/lib/diagnostic-motor";
import { prisma } from "@/lib/prisma";

export const PREFIXO_QUEST_ALAVANCA = "[Alavanca] ";

/** Incrementar ao mudar formato da quest — força atualização no banco */
const VERSAO_COPY = "v3";

function chaveQuest(tipo: "materia" | "padrao", id: string) {
  return `${tipo}:${id}:${VERSAO_COPY}`;
}

function normMateria(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function materiasCoincidem(a: string, b: string): boolean {
  const na = normMateria(a);
  const nb = normMateria(b);
  return na.includes(nb) || nb.includes(na);
}

function montarQuestPadrao(cluster: ClusterAgregado, materia: string): {
  chave: string;
  titulo: string;
  descricao: string;
  duracaoMin: number;
} {
  const def = CLUSTERS_PEDAGOGICOS[cluster.clusterId];
  const passos = PASSOS_POR_CLUSTER[cluster.clusterId];
  const porQue = `prioridade da sua jornada em ${materia} — ${def.tituloHumano.toLowerCase()}.`;
  const duracao = 40;

  return {
    chave: chaveQuest("padrao", cluster.clusterId),
    titulo: `${PREFIXO_QUEST_ALAVANCA}${def.tituloHumano}`,
    descricao: formatarPassos(passos, porQue, duracao),
    duracaoMin: duracao,
  };
}

function montarQuestMateria(a: AlavancaJornada): {
  chave: string;
  titulo: string;
  descricao: string;
  materiaId: string;
  duracaoMin: number;
} {
  const duracao = 45;
  const passos = [
    `Abra ${a.label} no material que você já usa (apostila, lista ou videoaula).`,
    "Faça 15 questões dos assuntos que mais apareceram nos seus erros recentes.",
    "Corrija na hora — não deixe para o dia seguinte.",
    "Anote os números das que ainda travou (1 linha cada).",
    "Nos últimos 5 min, releia só as que errou.",
  ];
  const porQue = `${a.label} está com ${a.pctAcerto}% de acerto na jornada; melhorar aqui costuma liberar mais nota.`;

  return {
    chave: chaveQuest("materia", a.materiaId),
    titulo: `${PREFIXO_QUEST_ALAVANCA}${a.label}: 15 questões corrigidas`,
    descricao: formatarPassos(passos, porQue, duracao),
    materiaId: a.materiaId,
    duracaoMin: duracao,
  };
}

/** Sincroniza quests de alavanca — cria ou atualiza texto quando a prioridade muda. */
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

  const clusterTop = insight.clustersPedagogicos[0];
  const materiaDeficit = insight.principalGargalo?.materiaDeficitPrincipal ?? null;

  let materiaDoPadrao: string | null = null;
  if (clusterTop) {
    materiaDoPadrao =
      clusterTop.materias[0]?.nome ?? materiaDeficit ?? "sua matéria prioritária";
    desejadas.push(montarQuestPadrao(clusterTop, materiaDoPadrao));
  }

  const padraoJaCobreMateria =
    clusterTop &&
    materiaDoPadrao &&
    materiaDeficit &&
    materiasCoincidem(materiaDoPadrao, materiaDeficit);

  if (!padraoJaCobreMateria) {
    for (const a of insight.alavancas.filter((x) => x.potencial === "alto").slice(0, 1)) {
      desejadas.push(montarQuestMateria(a));
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

  const pendentesAtualizados = await prisma.quest.findMany({
    where: {
      userId,
      status: "pending",
      titulo: { startsWith: PREFIXO_QUEST_ALAVANCA },
    },
  });

  const porChave = new Map<string, (typeof pendentesAtualizados)[0]>();
  for (const q of pendentesAtualizados) {
    const chave = extrairChaveQuest(q.descricao ?? "");
    if (chave) porChave.set(chave, q);
  }

  const criar: typeof desejadas = [];

  for (const d of desejadas) {
    const existente = porChave.get(d.chave);
    const descricaoCompleta = `<!-- ${d.chave} -->\n${d.descricao}`;

    if (existente) {
      const descLimpa = limparDescricaoQuest(existente.descricao);
      if (existente.titulo !== d.titulo || descLimpa !== d.descricao) {
        await prisma.quest.update({
          where: { id: existente.id },
          data: {
            titulo: d.titulo,
            descricao: descricaoCompleta,
            duracaoMin: d.duracaoMin,
            materiaId: d.materiaId ?? existente.materiaId,
            rewardMsg:
              "Cada passo feito com correção vale mais que fazer lista sem olhar o erro.",
          },
        });
      }
    } else {
      criar.push(d);
    }
  }

  if (criar.length === 0) return;

  await prisma.quest.createMany({
    data: criar.map((d) => ({
      userId,
      titulo: d.titulo,
      descricao: `<!-- ${d.chave} -->\n${d.descricao}`,
      materiaId: d.materiaId,
      duracaoMin: d.duracaoMin,
      rewardMsg:
        "Cada passo feito com correção vale mais que fazer lista sem olhar o erro.",
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

export function tituloQuestExibicao(titulo: string): string {
  return titulo.replace(/^\[Alavanca\]\s*/i, "").trim();
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
    titulo: tituloQuestExibicao(q.titulo),
    descricao: limparDescricaoQuest(q.descricao),
  }));
}
