import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { getMateriaLabel, getTemaLabel } from "@/lib/taxonomy";
import { PageBackLink } from "@/components/page-back-link";
import { TabelaQuestoesRegistro } from "@/components/tabela-questoes-registro";
import { SugestoesRegistroResumo } from "@/components/sugestoes-registro-resumo";
import { AnaliseErros } from "@/components/analise-erros";
import { ExcluirRegistroButton } from "@/components/excluir-registro-button";
import { Card, Badge, LinkButton } from "@/components/ui";

export default async function SimuladoQuestoesPage({
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
  const semGabaritoAluno = exam.questionAttempts.every((q) => !q.respostaAluno);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <PageBackLink href={`/simulados/${exam.id}`}>Análise da prova</PageBackLink>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Questões e erros</h1>
          <Badge tone="neutral">{exam.nome}</Badge>
        </div>
        <p className="text-sm text-slate-600">
          Aplicada em {formatDataAplicacao(exam.data)} · {total > 0 ? Math.round((acertos / total) * 100) : 0}% ·{" "}
          {acertos}/{total} acertos
        </p>
      </header>

      <SugestoesRegistroResumo examId={exam.id} />

      <AnaliseErros examId={exam.id} attempts={exam.questionAttempts} />

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

      <Card>
        <h2 className="mb-1 font-semibold">Todas as questões — seu gabarito × oficial</h2>
        <p className="mb-4 text-xs text-slate-500">
          Achou matéria ou assunto errado? Use <strong>Classificação errada?</strong> em cada linha —
          a equipe revisa e você pode ganhar XP.
        </p>
        <TabelaQuestoesRegistro
          examId={exam.id}
          linhas={[...exam.questionAttempts]
            .sort((a, b) => a.numero - b.numero)
            .map((q) => ({
              numero: q.numero,
              respostaAluno: q.respostaAluno,
              gabarito: q.provaQuestao?.gabarito ?? null,
              materia: q.provaQuestao ? q.provaQuestao.materia : getMateriaLabel(q.materiaId),
              assunto: q.provaQuestao
                ? q.provaQuestao.assunto
                : getTemaLabel(q.materiaId, q.temaId),
              conhecimento: q.provaQuestao?.conhecimentoExigido ?? null,
              nivelDificuldade: q.provaQuestao?.nivelDificuldade ?? null,
              correto: q.correto,
              podeSugerir: Boolean(q.provaQuestaoId && q.provaQuestao),
            }))}
        />
        {semGabaritoAluno && (
          <p className="mt-3 text-xs text-amber-700">
            Este registro não incluiu seu gabarito (modo «só erros»). Na próxima vez, use «Meu
            gabarito» para ver acertos e erros questão a questão.
          </p>
        )}
      </Card>
    </div>
  );
}
