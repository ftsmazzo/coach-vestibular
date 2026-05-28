import type { JourneyInsight } from "@/lib/journey-insight";
import type { StructuredAnamneseProfile } from "@/lib/anamnese-types";
import type { AlavancaJornada } from "@/lib/journey-insight";
import { formatarPassos, PASSOS_POR_CLUSTER } from "@/lib/copiloto-passos";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";
import type { ClusterAgregado } from "@/lib/diagnostic-motor";
import { prisma } from "@/lib/prisma";

/** Legado — novas quests usam marcador na descrição, sem prefixo no título */
export const PREFIXO_QUEST_ALAVANCA = "[Alavanca] ";

const VERSAO_COPY = "v5";

export type QuestCopiloto = {
  id: string;
  titulo: string;
  descricao: string;
  duracaoMin: number;
  ordem: number;
  rotulo: string;
};

/** Identidade estável da quest (sem ordem — evita duplicar ao reordenar). */
function chaveQuest(tipo: "padrao" | "materia" | "anamnese", id: string) {
  return `copiloto:${tipo}:${id}:${VERSAO_COPY}`;
}

/** Agrupa chaves antigas (com ordem no meio) e novas. */
export function chaveSemanticaQuest(chave: string | null): string | null {
  if (!chave) return null;
  const m = chave.match(/^copiloto:(?:(\d+):)?(padrao|materia|anamnese):([^:]+)/);
  if (m) return `${m[2]}:${m[3]}`;
  return null;
}

function descricaoComChave(chave: string, ordem: number, corpo: string) {
  return `<!-- ${chave} #o=${ordem} -->\n${corpo}`;
}

function chaveEstaNaVersaoAtual(chave: string | null): boolean {
  return Boolean(chave?.endsWith(`:${VERSAO_COPY}`));
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
    chave: chaveQuest("padrao", cluster.clusterId),
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
    chave: chaveQuest("materia", a.materiaId),
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

  if (desejadas.length === 0 && insight.anamnese?.completed && insight.anamnese.profile) {
    desejadas.push(...montarQuestsDaAnamnese(insight.anamnese.profile));
  }

  return desejadas;
}

function montarQuestsDaAnamnese(profile: StructuredAnamneseProfile) {
  const desejadas: ReturnType<typeof montarListaDesejada> = [];
  const passos: string[] = [];

  if (profile.metacognition?.metacognitiveMaturity === "BAIXA") {
    passos.push(
      "Escolha 5 erros recentes (de qualquer lista ou simulado).",
      "Para cada um, escreva em uma frase: foi conteúdo, interpretação, pressa ou insegurança?",
      "Marque quantos caem no mesmo tipo — esse é seu padrão inicial.",
      "Nos últimos 5 min, escolha só 2 para refazer com calma.",
    );
  } else if (profile.examBehavior?.fatigueInLongExams) {
    passos.push(
      "Separe 20 questões em dois blocos de 10 (sem pausa longa entre blocos).",
      "Após o bloco 1, anote de 0 a 5 sua clareza mental.",
      "No bloco 2, se a clareza cair, pause 2 min antes de continuar.",
      "Ao final, compare em quais números você errou mais.",
    );
  } else {
    const mat = profile.academicSelfPerception?.perceivedWeakSubjects?.[0] ?? "sua matéria mais fraca";
    passos.push(
      `Abra ${mat} no material que você já usa.`,
      "Faça 10 questões curtas — sem cronômetro na primeira passada.",
      "Corrija e anote o que travou em cada erro.",
      "Refaça só as que errou, explicando o passo em voz alta.",
    );
  }

  desejadas.push({
    chave: chaveQuest("anamnese", "inicial"),
    titulo: "Comece por aqui: primeiro passo da sua jornada",
    descricao: formatarPassos(
      passos,
      "baseado na conversa inicial com o copiloto — antes dos registros de prova.",
      35
    ),
    duracaoMin: 35,
    ordem: 1,
    rotulo: "Prioridade da semana",
  });

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
  const m = descricao.match(/^<!--\s*([^\s#]+)/);
  return m?.[1] ?? null;
}

export function extrairOrdemQuest(descricao: string | null, chave: string | null): number {
  const m = (descricao ?? "").match(/#o=(\d+)/);
  if (m) return Number(m[1]);
  const legado = chave?.match(/^copiloto:(\d+):/);
  return legado ? Number(legado[1]) : 99;
}

export function limparDescricaoQuest(descricao: string | null): string {
  if (!descricao) return "";
  return descricao.replace(/^<!--\s*[^\n]+\s*-->\n?/, "").trim();
}

export function tituloQuestExibicao(titulo: string): string {
  return titulo.replace(/^\[Alavanca\]\s*/i, "").trim();
}

/** Mantém só uma quest pendente por padrão/matéria; arquiva cópias e chaves antigas. */
async function deduplicarQuestsCopilotoPendentes(userId: string) {
  const pendentes = await prisma.quest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const copiloto = pendentes.filter(isQuestCopiloto);
  const porSemantica = new Map<string, typeof copiloto>();

  for (const q of copiloto) {
    const chave = extrairChaveQuest(q.descricao ?? "");
    const sem =
      chaveSemanticaQuest(chave) ??
      `legado:${tituloQuestExibicao(q.titulo).toLowerCase().slice(0, 80)}`;
    const list = porSemantica.get(sem) ?? [];
    list.push(q);
    porSemantica.set(sem, list);
  }

  for (const list of porSemantica.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => {
      const ca = extrairChaveQuest(a.descricao ?? "");
      const cb = extrairChaveQuest(b.descricao ?? "");
      const va = chaveEstaNaVersaoAtual(ca) ? 2 : 0;
      const vb = chaveEstaNaVersaoAtual(cb) ? 2 : 0;
      if (va !== vb) return vb - va;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    for (const dup of list.slice(1)) {
      await prisma.quest.update({
        where: { id: dup.id },
        data: { status: "skipped" },
      });
    }
  }
}

/** Sincroniza as quests da jornada (única fonte de tarefas práticas). */
export async function garantirQuestsAlavanca(
  userId: string,
  insight: JourneyInsight
): Promise<void> {
  const soAnamnese = !insight.temDados && insight.anamnese?.completed;
  if (!insight.temDados && !soAnamnese) return;

  await arquivarQuestsPlanoDuplicadas(userId);
  await deduplicarQuestsCopilotoPendentes(userId);

  const desejadas = montarListaDesejada(insight);
  if (desejadas.length === 0) return;

  const chavesDesejadas = new Set(desejadas.map((d) => d.chave));
  const semanticasDesejadas = new Set(
    desejadas.map((d) => chaveSemanticaQuest(d.chave)).filter(Boolean) as string[]
  );

  const pendentesCopiloto = await prisma.quest.findMany({
    where: { userId, status: "pending" },
  });

  for (const q of pendentesCopiloto) {
    if (!isQuestCopiloto(q)) continue;
    const chaveAtual = extrairChaveQuest(q.descricao ?? "");
    const sem = chaveSemanticaQuest(chaveAtual);
    const obsoleta =
      !chaveAtual ||
      !chaveEstaNaVersaoAtual(chaveAtual) ||
      (sem ? !semanticasDesejadas.has(sem) : !chavesDesejadas.has(chaveAtual));
    if (obsoleta) {
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
  const porSemantica = new Map<string, (typeof pendentesAtualizados)[0]>();
  for (const q of pendentesAtualizados) {
    if (!isQuestCopiloto(q)) continue;
    const chave = extrairChaveQuest(q.descricao ?? "");
    if (!chave || !chaveEstaNaVersaoAtual(chave)) continue;
    porChave.set(chave, q);
    const sem = chaveSemanticaQuest(chave);
    if (sem) porSemantica.set(sem, q);
  }

  const criar: typeof desejadas = [];

  for (const d of desejadas) {
    const existente =
      porChave.get(d.chave) ?? porSemantica.get(chaveSemanticaQuest(d.chave) ?? "") ?? null;
    const descricaoCompleta = descricaoComChave(d.chave, d.ordem, d.descricao);

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
        descricao: descricaoComChave(d.chave, d.ordem, d.descricao),
        materiaId: d.materiaId,
        duracaoMin: d.duracaoMin,
        rewardMsg: "Passo a passo feito com correção vale mais que lista sem olhar o erro.",
      })),
    });
  }

  await deduplicarQuestsCopilotoPendentes(userId);
}

export async function getOQueFazerAgora(userId: string): Promise<QuestCopiloto[]> {
  await deduplicarQuestsCopilotoPendentes(userId);

  const todas = await prisma.quest.findMany({
    where: { userId, status: "pending" },
  });

  const vistos = new Set<string>();
  const copiloto = todas
    .filter(isQuestCopiloto)
    .map((q) => {
      const chave = extrairChaveQuest(q.descricao ?? "");
      const sem =
        chaveSemanticaQuest(chave) ??
        `legado:${tituloQuestExibicao(q.titulo).toLowerCase()}`;
      const ordem = extrairOrdemQuest(q.descricao, chave);
      let rotulo = "Esta semana";
      if (chave?.includes(":padrao:")) {
        rotulo = ordem === 1 ? "Prioridade da semana" : "Também vale atenção";
      } else if (chave?.includes(":materia:")) {
        rotulo = "Reforço de matéria";
      }
      return {
        id: q.id,
        titulo: tituloQuestExibicao(q.titulo),
        descricao: limparDescricaoQuest(q.descricao),
        duracaoMin: q.duracaoMin,
        ordem,
        rotulo,
        sem,
        chaveAtual: chave,
      };
    })
    .sort((a, b) => {
      const va = chaveEstaNaVersaoAtual(a.chaveAtual) ? 0 : 1;
      const vb = chaveEstaNaVersaoAtual(b.chaveAtual) ? 0 : 1;
      if (va !== vb) return va - vb;
      return a.ordem - b.ordem;
    })
    .filter((q) => {
      if (vistos.has(q.sem)) return false;
      vistos.add(q.sem);
      return true;
    })
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ sem: _sem, chaveAtual: _c, ...rest }) => rest);

  return copiloto;
}

/** @deprecated use getOQueFazerAgora */
export async function getQuestsAlavancaPendentes(userId: string) {
  return getOQueFazerAgora(userId);
}
