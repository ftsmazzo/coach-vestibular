import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadConjuntoExamView } from "@/lib/conjunto-exam-view";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { parseConjuntoExamId } from "@/lib/prova-multidia";
import { labelEscopo } from "@/lib/escopo-display-server";
import { conhecimentoExigidoExibicao } from "@/lib/jornada-classificacao-attempt";
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
  const conjuntoIds = parseConjuntoExamId(id);

  if (conjuntoIds) {
    const [examIdDia1, examIdDia2] = conjuntoIds;
    const conjunto = await loadConjuntoExamView(session.userId, examIdDia1, examIdDia2);
    if (!conjunto) notFound();

    const total = conjunto.questionAttempts.length;
    const acertos = conjunto.acertos;
    const semGabaritoAluno = conjunto.questionAttempts.every((q) => !q.respostaAluno);

    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <PageBackLink href={`/simulados/${id}`}>Análise da prova</PageBackLink>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Questões e erros</h1>
            <Badge tone="success">180 questões (2 dias)</Badge>
          </div>
          <p className="text-sm font-medium text-slate-700">{conjunto.nome}</p>
          <p className="text-sm text-slate-600">
            {conjunto.dataLabel} · {total > 0 ? Math.round((acertos / total) * 100) : 0}% ·{" "}
            {acertos}/{total} acertos
          </p>
        </header>

        <Card className="border-teal-100 bg-teal-50/40">
          <p className="text-sm text-teal-900">
            Classificação de erros continua por dia — use os links abaixo se quiser detalhar causa
            em cada registro.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href={`/simulados/${examIdDia1}/questoes`} variant="secondary" className="text-sm">
              Erros do dia 1
            </LinkButton>
            <LinkButton href={`/simulados/${examIdDia2}/questoes`} variant="secondary" className="text-sm">
              Erros do dia 2
            </LinkButton>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Todas as questões (1–{total})</h2>
          <TabelaQuestoesRegistro
            examId={examIdDia1}
            linhas={conjunto.questionAttempts.map((q) => ({
              numero: q.numero,
              respostaAluno: q.respostaAluno,
              gabarito: q.provaQuestao?.gabarito ?? null,
              materia: q.provaQuestao?.materia ?? "—",
              assunto: q.provaQuestao?.assunto ?? "—",
              escopoId: q.provaQuestao?.conhecimentoEscopoId ?? q.conhecimentoEscopoId ?? null,
              escopoLabel: labelEscopo(q.provaQuestao?.conhecimentoEscopoId ?? q.conhecimentoEscopoId),
              conhecimento: conhecimentoExigidoExibicao(q, q.provaQuestao),
              nivelDificuldade: q.provaQuestao?.nivelDificuldade ?? null,
              correto: q.correto,
              podeSugerir: Boolean(q.provaQuestaoId && q.provaQuestao),
            }))}
          />
          {semGabaritoAluno && (
            <p className="mt-3 text-xs text-amber-700">
              Um dos registros não incluiu gabarito completo.
            </p>
          )}
        </Card>
      </div>
    );
  }

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
          Achou escopo N2 errado? Use <strong>Classificação errada?</strong> em cada linha —
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
              materia: q.provaQuestao?.materia ?? "—",
              assunto: q.provaQuestao?.assunto ?? "—",
              escopoId: q.provaQuestao?.conhecimentoEscopoId ?? q.conhecimentoEscopoId ?? null,
              escopoLabel: labelEscopo(q.provaQuestao?.conhecimentoEscopoId ?? q.conhecimentoEscopoId),
              conhecimento: conhecimentoExigidoExibicao(q, q.provaQuestao),
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
