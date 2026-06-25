/**
 * Mini-quiz dirigido de fechamento do ciclo — filtrado por metaEscopoId (N2).
 */
import { prisma } from "@/lib/prisma";
import { getCicloAtivo } from "@/lib/ciclo";

const N_ITENS = 6;

export type QuizItem = {
  provaQuestaoId: string;
  provaNome: string;
  numero: number;
  materia: string;
  assunto: string;
  enunciado: string | null;
  gabarito: string;
};

export type QuizItemPublico = Omit<QuizItem, "gabarito">;

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function semGabarito(items: QuizItem[]): QuizItemPublico[] {
  return items.map(({ gabarito: _g, ...rest }) => rest);
}

async function selecionarItens(
  userId: string,
  metaEscopoId: string | null,
  metaMateria: string | null
): Promise<QuizItem[]> {
  if (!metaEscopoId) return [];

  const candidatas = await prisma.provaQuestao.findMany({
    where: {
      gabarito: { not: null },
      conhecimentoEscopoId: metaEscopoId,
      prova: { publicada: true },
    },
    select: {
      id: true,
      numero: true,
      materia: true,
      assunto: true,
      conhecimentoExigido: true,
      enunciado: true,
      gabarito: true,
      prova: { select: { nome: true } },
    },
    take: 400,
  });

  let base = candidatas;
  if (base.length < N_ITENS && metaMateria) {
    const extra = await prisma.provaQuestao.findMany({
      where: {
        gabarito: { not: null },
        prova: { publicada: true },
        materia: { contains: metaMateria.split(/\s+/)[0]!, mode: "insensitive" },
      },
      select: {
        id: true,
        numero: true,
        materia: true,
        assunto: true,
        conhecimentoExigido: true,
        enunciado: true,
        gabarito: true,
        prova: { select: { nome: true } },
      },
      take: 200,
    });
    base = [...candidatas, ...extra];
  }

  const feitas = await prisma.questionAttempt.findMany({
    where: { exam: { userId }, provaQuestaoId: { not: null } },
    select: { provaQuestaoId: true },
  });
  const idsFeitas = new Set(feitas.map((f) => f.provaQuestaoId));

  const novas = base.filter((q) => !idsFeitas.has(q.id));
  const repostas = base.filter((q) => idsFeitas.has(q.id));
  const ordenadas = [...embaralhar(novas), ...embaralhar(repostas)].slice(0, N_ITENS);

  return ordenadas.map((q) => ({
    provaQuestaoId: q.id,
    provaNome: q.prova?.nome ?? "Prova",
    numero: q.numero,
    materia: q.materia,
    assunto: q.assunto,
    enunciado: q.enunciado ?? null,
    gabarito: (q.gabarito ?? "").toUpperCase(),
  }));
}

export async function gerarOuObterQuiz(userId: string): Promise<{
  quizId: string | null;
  itens: QuizItemPublico[];
  metaTitulo: string | null;
  insuficiente: boolean;
}> {
  const ciclo = await getCicloAtivo(userId);
  if (!ciclo) return { quizId: null, itens: [], metaTitulo: null, insuficiente: true };

  const existente = await prisma.cicloQuiz.findFirst({
    where: { cicloId: ciclo.id, status: "EM_ABERTO" },
    orderBy: { createdAt: "desc" },
  });
  if (existente) {
    const itens = JSON.parse(existente.itemsJson) as QuizItem[];
    return {
      quizId: existente.id,
      itens: semGabarito(itens),
      metaTitulo: ciclo.metaTitulo,
      insuficiente: itens.length === 0,
    };
  }

  const itens = await selecionarItens(userId, ciclo.metaEscopoId, ciclo.metaMateria);
  if (itens.length < 3) {
    return { quizId: null, itens: [], metaTitulo: ciclo.metaTitulo, insuficiente: true };
  }

  const quiz = await prisma.cicloQuiz.create({
    data: {
      cicloId: ciclo.id,
      escopoAlvo: ciclo.metaEscopoId,
      materiaAlvo: ciclo.metaMateria,
      itemsJson: JSON.stringify(itens),
      totalQuestoes: itens.length,
    },
  });

  return {
    quizId: quiz.id,
    itens: semGabarito(itens),
    metaTitulo: ciclo.metaTitulo,
    insuficiente: false,
  };
}

export async function corrigirQuiz(
  userId: string,
  quizId: string,
  respostas: Record<string, string>
): Promise<{ pctAcerto: number; acertos: number; total: number } | { error: string }> {
  const quiz = await prisma.cicloQuiz.findFirst({
    where: { id: quizId, ciclo: { userId } },
  });
  if (!quiz) return { error: "QUIZ_NAO_ENCONTRADO" };
  if (quiz.status === "CONCLUIDO") {
    return {
      pctAcerto: quiz.pctAcerto ?? 0,
      acertos: Math.round(((quiz.pctAcerto ?? 0) / 100) * quiz.totalQuestoes),
      total: quiz.totalQuestoes,
    };
  }

  const itens = JSON.parse(quiz.itemsJson) as QuizItem[];
  let acertos = 0;
  for (const it of itens) {
    const r = (respostas[it.provaQuestaoId] ?? "").toUpperCase();
    if (r && r === it.gabarito) acertos++;
  }
  const total = itens.length;
  const pctAcerto = total > 0 ? Math.round((acertos / total) * 100) : 0;

  await prisma.cicloQuiz.update({
    where: { id: quiz.id },
    data: {
      respostasJson: JSON.stringify(respostas),
      pctAcerto,
      status: "CONCLUIDO",
      completedAt: new Date(),
    },
  });

  return { pctAcerto, acertos, total };
}
