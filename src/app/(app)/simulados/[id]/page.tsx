import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { XpToastFromUrl } from "@/components/xp-toast-from-url";
import { getSession } from "@/lib/auth";
import { formatDataAplicacao } from "@/lib/data-prova";
import { prisma } from "@/lib/prisma";
import { labelModoUso, descricaoModoUso } from "@/lib/modo-uso";
import { categoriaDoRegistro, labelCategoriaRegistro } from "@/lib/prova-tipo";
import { Card, Badge, LinkButton } from "@/components/ui";
import { ExamGraficos } from "@/components/exam-graficos";
import { montarExamGraficos } from "@/lib/exam-graficos";
import { ExcluirRegistroButton } from "@/components/excluir-registro-button";

export default async function SimuladoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.userId },
    include: {
      prova: true,
      questionAttempts: { include: { provaQuestao: true }, orderBy: { numero: "asc" } },
    },
  });

  if (!exam) notFound();

  const total = exam.questionAttempts.length;
  const acertos = exam.questionAttempts.filter((q) => q.correto).length;
  const errosCount = total - acertos;
  const cat = categoriaDoRegistro(exam);
  const graficos = montarExamGraficos(exam.questionAttempts);
  const semGabaritoAluno = total > 0 && exam.questionAttempts.every((q) => !q.respostaAluno);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <XpToastFromUrl />
      </Suspense>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{exam.nome}</h1>
          <Badge tone={cat === "prova_oficial" ? "success" : "neutral"}>
            {labelCategoriaRegistro(cat)}
          </Badge>
          <Badge tone="neutral">{labelModoUso(exam.modoUso)}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Aplicada em {formatDataAplicacao(exam.data)} ·{" "}
          {total > 0 ? Math.round((acertos / total) * 100) : 0}% · {exam.banca}
        </p>
        <p className="mt-1 text-xs text-slate-500">{descricaoModoUso(exam.modoUso)}</p>
      </div>

      {exam.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Plano com metas menores — ativado por desempenho baixo e/ou check-in emocional 1–2.
          </p>
        </Card>
      )}

      {total > 0 ? (
        <section className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Os números desta prova</h2>
          <p className="text-xs text-slate-500">
            Matérias, causas de erro e conhecimentos — só desta tentativa. A leitura por extenso e o
            micro-plano ficam na <strong>Lente</strong> da prova.
          </p>
          <div className="pt-2">
            <ExamGraficos data={graficos} />
          </div>
          {semGabaritoAluno && (
            <p className="pt-2 text-xs text-amber-700">
              Este registro não incluiu seu gabarito (modo «só erros») — por isso o acerto por
              questão fica limitado. Na próxima, use «Meu gabarito».
            </p>
          )}
        </section>
      ) : (
        <Card>
          <p className="text-sm text-slate-600">Este registro não tem questões para analisar.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {exam.provaId && (
          <LinkButton
            href={`/simulados/novo?provaId=${exam.provaId}`}
            variant="secondary"
            className="w-full text-center sm:w-auto"
          >
            Corrigir gabarito
          </LinkButton>
        )}
        <ExcluirRegistroButton
          examId={exam.id}
          nome={exam.nome}
          variant="danger"
          redirectTo={exam.provaId ? `/provas/${exam.provaId}/lente` : "/provas"}
        />
      </div>

      <Card className="border-teal-200 bg-teal-50/40">
        <h2 className="font-semibold text-teal-950">Questões e classificação de erros</h2>
        <p className="mt-2 text-sm text-teal-900">
          Veja questão a questão (sua resposta × gabarito, conhecimento exigido) e classifique
          {errosCount > 0 ? ` os ${errosCount} erro(s)` : " seus erros"} para afinar o plano.
        </p>
        <LinkButton href={`/simulados/${exam.id}/questoes`} className="mt-4 w-full sm:w-auto">
          Abrir questões e erros
        </LinkButton>
      </Card>

      <LinkButton href="/plano" variant="secondary">
        Ver plano da semana
      </LinkButton>
    </div>
  );
}
