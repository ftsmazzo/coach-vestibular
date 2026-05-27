import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { XpToastFromUrl } from "@/components/xp-toast-from-url";
import { getSession } from "@/lib/auth";
import { formatDataAplicacao } from "@/lib/data-prova";
import { prisma } from "@/lib/prisma";
import { labelModoUso, descricaoModoUso } from "@/lib/modo-uso";
import {
  categoriaDoRegistro,
  labelCategoriaRegistro,
} from "@/lib/prova-tipo";
import { SugestoesRegistroResumo } from "@/components/sugestoes-registro-resumo";
import { TabelaQuestoesRegistro } from "@/components/tabela-questoes-registro";
import { getMateriaLabel, getTemaLabel } from "@/lib/taxonomy";
import { Card, Badge, LinkButton } from "@/components/ui";
import { ResumoDiagnosticoCard } from "@/components/resumo-diagnostico";
import { AnaliseErros } from "@/components/analise-erros";
import type { ResumoProvaDiagnostico } from "@/lib/diagnosis-prova";

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
      diagnosticSnapshot: true,
    },
  });

  if (!exam) notFound();

  const snapshot = exam.diagnosticSnapshot;
  const focos = snapshot ? JSON.parse(snapshot.focosJson) : [];
  const scores = snapshot ? JSON.parse(snapshot.scoresJson) : null;
  const resumoProva = scores?.resumoProva as ResumoProvaDiagnostico | undefined;
  const total = exam.questionAttempts.length;
  const acertos = exam.questionAttempts.filter((q) => q.correto).length;
  const cat = categoriaDoRegistro(exam);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <XpToastFromUrl />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{exam.nome}</h1>
            <Badge tone={cat === "prova_oficial" ? "success" : "neutral"}>
              {labelCategoriaRegistro(cat)}
            </Badge>
            <Badge tone="neutral">{labelModoUso(exam.modoUso)}</Badge>
          </div>
          <p className="text-slate-600">
            Aplicada em {formatDataAplicacao(exam.data)} · {Math.round((acertos / total) * 100)}% ·{" "}
            {exam.banca}
          </p>
          <p className="mt-1 text-xs text-slate-500">{descricaoModoUso(exam.modoUso)}</p>
        </div>
        {exam.provaId && (
          <LinkButton
            href={`/simulados/novo?provaId=${exam.provaId}`}
            variant="secondary"
            className="w-full text-center sm:w-auto"
          >
            Corrigir gabarito
          </LinkButton>
        )}
      </div>

      {exam.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Plano com metas menores — ativado por desempenho baixo e/ou check-in emocional 1–2.
          </p>
        </Card>
      )}

      {resumoProva ? (
        <ResumoDiagnosticoCard resumo={resumoProva} checkIn={exam.checkInScore} />
      ) : (
        <Card className="border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-950">
            Este registro foi salvo antes do diagnóstico detalhado (ou só com lista de erros).
            {exam.provaId ? (
              <>
                {" "}
                Use <strong>Refazer diagnóstico e plano</strong> se já informou o gabarito
                completo, ou <strong>Substituir registro</strong> em Registrar resultado com todas
                as linhas <code className="text-xs">número,letra</code>.
              </>
            ) : (
              " Registre de novo em Atividades."
            )}
          </p>
        </Card>
      )}

      {snapshot && (
        <Card>
          <h2 className="mb-2 font-semibold">Leitura do coach</h2>
          <p className="text-slate-700">{snapshot.mensagem}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {focos.map(
              (
                f: { label: string; prioridade: string; motivo?: string },
                i: number
              ) => (
                <div key={i} className="w-full sm:w-auto">
                  <Badge tone={f.prioridade === "alta" ? "danger" : "warning"}>
                    {f.label}
                  </Badge>
                  {f.motivo && (
                    <p className="mt-1 text-xs text-slate-500">{f.motivo}</p>
                  )}
                </div>
              )
            )}
          </div>
        </Card>
      )}

      <SugestoesRegistroResumo examId={exam.id} />

      <Card>
        <h2 className="mb-1 font-semibold">Questões — seu gabarito × oficial</h2>
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
              materia: q.provaQuestao
                ? q.provaQuestao.materia
                : getMateriaLabel(q.materiaId),
              assunto: q.provaQuestao
                ? q.provaQuestao.assunto
                : getTemaLabel(q.materiaId, q.temaId),
              conhecimento: q.provaQuestao?.conhecimentoExigido ?? null,
              nivelDificuldade: q.provaQuestao?.nivelDificuldade ?? null,
              correto: q.correto,
              podeSugerir: Boolean(q.provaQuestaoId && q.provaQuestao),
            }))}
        />
        {exam.questionAttempts.every((q) => !q.respostaAluno) && (
          <p className="mt-3 text-xs text-amber-700">
            Este registro não incluiu seu gabarito (modo «só erros»). Na próxima vez, use «Meu
            gabarito» para ver acertos e erros questão a questão.
          </p>
        )}
      </Card>

      <AnaliseErros examId={exam.id} attempts={exam.questionAttempts} />

      <LinkButton href="/plano">Ver plano da semana</LinkButton>
    </div>
  );
}
