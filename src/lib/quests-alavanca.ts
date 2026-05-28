import type { JourneyInsight } from "@/lib/journey-insight";
import type { AlavancaJornada } from "@/lib/journey-insight";
import { formatarPassos, PASSOS_POR_CLUSTER } from "@/lib/copiloto-passos";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";
import type { ClusterAgregado } from "@/lib/diagnostic-motor";
import { prisma } from "@/lib/prisma";

/** Legado — novas quests usam marcador na descrição, sem prefixo no título */
export const PREFIXO_QUEST_ALAVANCA = "[Alavanca] ";

const VERSAO_COPY = "v4";

export type QuestCopiloto = {
  id: string;
  titulo: string;
  descricao: string;
  duracaoMin: number;
  ordem: number;
  rotulo: string;
};

function chaveQuest(ordem: number, tipo: "padrao" | "materia", id: string) {
  return `copiloto:${ordem}:${tipo}:${id}:${VERSAO_COPY}`;
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

function montarQuestPadrao(
  cluster: ClusterAgregado,
  materia: string,
  ordem: number,
  rotulo: string
): {
  chave: string;
  titulo: string;
  descricao: string;
  duracaoMin: number;
  ordem: number;
  rotulo: string;
} {
  const def = CLUSTERS_PEDAGOGICOS[cluster.clusterId];
  const passos = PASSOS_POR_CLUSTER[cluster.clusterId];
  const duracao = ordem === 1 ? 40 : 35;

  const tituloPratica =
    ordem === 1
      ? `Comece por aqui: ${def.verboTreino}`
      : `Também treinar: ${def.verboTreino}`;

  return {
    chave: chaveQuest(ordem, "padrao", cluster.clusterId),
    titulo: tituloPratica,
    descricao: formatarPassos(
      passos,
      `${rotulo.toLowerCase()} em ${materia} — olhando sua jornada inteira, não só a última prova.`,
      duracao
    ),
    duracaoMin: duracao,
    ordem,
    rotulo,
  };
}

function montarQuestMateria(a: AlavancaJornada, ordem: number): {
  chave: string;
  titulo: string;
  descricao: string;
  materiaId: string;
  duracaoMin: number;
  ordem: number;
  rotulo: string;
} {
  const duracao = 45;
  const passos = [
    `Abra ${a.label} no material que você já usa (apostila, lista ou videoaula).`,
    "Faça 15 questões dos temas que mais pesaram nos seus erros na jornada.",
    "Corrija na hora — não deixe para o dia seguinte.",
    "Anote em 1 linha o que travou em cada erro.",
    "Nos últimos 5 min, releia só as que errou.",
  ];

  return {
    chave: chaveQuest(ordem, "materia", a.materiaId),
    titulo: `${a.label}: bloco de correção`,
    descricao: formatarPassos(
      passos,
      `${a.label} está com ${a.pctAcerto}% na jornada — reforço curricular além do padrão principal.`,
      duracao
    ),
    materiaId: a.materiaId,
    duracaoMin: duracao,
    ordem,
    rotulo: "Reforço de matéria",
  };
}

function montarListaDesejada(insight: JourneyInsight) {
  const desejadas: Array<{
    chave: string;
    titulo: string;
    descricao: string;
    materiaId?: string;
    duracaoMin: number;
    ordem: number;
    rotulo: string;
  }> = [];

  const clusterTop = insight.clustersPedagogicos[0];
  const cluster2 = insight.clustersPedagogicos[1];
  const materiaDeficit = insight.principalGargalo?.materiaDeficitPrincipal ?? null;

  let ordem = 1;

  if (clusterTop) {
    const materia =
      clusterTop.materias[0]?.nome ?? materiaDeficit ?? "sua matéria prioritária";
    desejadas.push(
      montarQuestPadrao(clusterTop, materia, ordem++, "Prioridade da semana")
    );
  }

  if (
    cluster2 &&
    clusterTop &&
    cluster2.clusterId !== clusterTop.clusterId
  ) {
    const mat2 = cluster2.materias[0]?.nome ?? "outra matéria";
    desejadas.push(
      montarQuestPadrao(cluster2, mat2, ordem++, "Também vale atenção")
    );
  }

  const materiaDoPadrao = clusterTop?.materias[0]?.nome ?? null;
  const padraoJaCobreMateria =
    clusterTop &&
    materiaDoPadrao &&
    materiaDeficit &&
    materiasCoincidem(materiaDoPadrao, materiaDeficit);

  if (!padraoJaCobreMateria) {
    const alavanca = insight.alavancas.find((x) => x.potencial === "alto");
    if (alavanca) {
      desejadas.push(montarQuestMateria(alavanca, ordem++));
    }
  }

  return desejadas;
}

/** Remove quests do plano legado que duplicam o copiloto (Prioridade 1…). */
async function arquivarQuestsPlanoDuplicadas(userId: string) {
  const pendentes = await prisma.quest.findMany({
    where: { userId, status: "pending" },
  });

  for (const q of pendentes) {
    if (isQuestCopiloto(q)) continue;
    const t = q.titulo;
    if (
      /^Prioridade \d/i.test(t) ||
      /— consolidar/i.test(t) ||
      /manter ritmo/i.test(t) ||
      t.startsWith(PREFIXO_QUEST_ALAVANCA)
    ) {
      await prisma.quest.update({
        where: { id: q.id },
        data: { status: "skipped" },
      });
    }
  }
}

export function isQuestCopiloto(q: { titulo: string; descricao: string | null }): boolean {
  if (q.titulo.startsWith(PREFIXO_QUEST_ALAVANCA)) return true;
  return (q.descricao ?? "").includes("<!-- copiloto:");
}

/** @deprecated use isQuestCopiloto */
export function isQuestAlavanca(titulo: string) {
  return titulo.startsWith(PREFIXO_QUEST_ALAVANCA);
}

export function extrairChaveQuest(descricao: string): string | null {
  const m = descricao.match(/^<!--\s*(\S+)\s*-->/);
  return m?.[1] ?? null;
}

function extrairOrdemChave(chave: string): number {
  const m = chave.match(/^copiloto:(\d+):/);
  return m ? Number(m[1]) : 99;
}

export function limparDescricaoQuest(descricao: string | null): string {
  if (!descricao) return "";
  return descricao.replace(/^<!--\s*\S+\s*-->\n?/, "").trim();
}

export function tituloQuestExibicao(titulo: string): string {
  return titulo.replace(/^\[Alavanca\]\s*/i, "").trim();
}

/** Sincroniza as quests da jornada (única fonte de tarefas práticas). */
export async function garantirQuestsAlavanca(
  userId: string,
  insight: JourneyInsight
): Promise<void> {
  if (!insight.temDados) return;

  await arquivarQuestsPlanoDuplicadas(userId);

  const desejadas = montarListaDesejada(insight);
  if (desejadas.length === 0) return;

  const chavesDesejadas = new Set(desejadas.map((d) => d.chave));

  const pendentesCopiloto = await prisma.quest.findMany({
    where: { userId, status: "pending" },
  });

  for (const q of pendentesCopiloto) {
    if (!isQuestCopiloto(q)) continue;
    const chaveAtual = extrairChaveQuest(q.descricao ?? "");
    if (!chaveAtual || !chavesDesejadas.has(chaveAtual)) {
      await prisma.quest.update({
        where: { id: q.id },
        data: { status: "skipped" },
      });
    }
  }

  const pendentesAtualizados = await prisma.quest.findMany({
    where: { userId, status: "pending" },
  });

  const porChave = new Map<string, (typeof pendentesAtualizados)[0]>();
  for (const q of pendentesAtualizados) {
    if (!isQuestCopiloto(q)) continue;
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
          },
        });
      }
    } else {
      criar.push(d);
    }
  }

  if (criar.length > 0) {
    await prisma.quest.createMany({
      data: criar.map((d) => ({
        userId,
        titulo: d.titulo,
        descricao: `<!-- ${d.chave} -->\n${d.descricao}`,
        materiaId: d.materiaId,
        duracaoMin: d.duracaoMin,
        rewardMsg: "Passo a passo feito com correção vale mais que lista sem olhar o erro.",
      })),
    });
  }
}

export async function getOQueFazerAgora(userId: string): Promise<QuestCopiloto[]> {
  const todas = await prisma.quest.findMany({
    where: { userId, status: "pending" },
  });

  const copiloto = todas
    .filter(isQuestCopiloto)
    .map((q) => {
      const chave = extrairChaveQuest(q.descricao ?? "") ?? "";
      const ordem = extrairOrdemChave(chave);
      let rotulo = "Esta semana";
      if (chave.includes(":padrao:")) {
        rotulo = ordem === 1 ? "Prioridade da semana" : "Também vale atenção";
      } else if (chave.includes(":materia:")) {
        rotulo = "Reforço de matéria";
      }
      return {
        id: q.id,
        titulo: tituloQuestExibicao(q.titulo),
        descricao: limparDescricaoQuest(q.descricao),
        duracaoMin: q.duracaoMin,
        ordem,
        rotulo,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  return copiloto;
}

/** @deprecated use getOQueFazerAgora */
export async function getQuestsAlavancaPendentes(userId: string) {
  return getOQueFazerAgora(userId);
}
