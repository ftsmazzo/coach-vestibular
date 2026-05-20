import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMateriaLabel, getTemaLabel } from "@/lib/taxonomy";
import { Card, Button, Badge } from "@/components/ui";
import { ExcluirRegistroButton } from "@/components/excluir-registro-button";
import { ResumoDiagnosticoCard } from "@/components/resumo-diagnostico";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{exam.nome}</h1>
          <p className="text-slate-600">
            {exam.data.toLocaleDateString("pt-BR")} · {Math.round((acertos / total) * 100)}% ·{" "}
            {exam.banca}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcluirRegistroButton examId={exam.id} nome={exam.nome} variant="secondary" />
          <Link href="/simulados">
            <Button variant="secondary">Meus registros</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
        </div>
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
        <Card>
          <p className="text-sm text-slate-600">
            Resumo numérico indisponível neste registro antigo. Registre de novo a prova para ver
            acertos/erros % e matérias com mais falhas.
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

      <Card>
        <h2 className="mb-4 font-semibold">Questões — seu gabarito × oficial</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="p-2">#</th>
                <th className="p-2">Sua resposta</th>
                <th className="p-2">Gabarito oficial</th>
                <th className="p-2">Matéria / Assunto</th>
                <th className="p-2">Conhecimento</th>
                <th className="p-2 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {exam.questionAttempts
                .sort((a, b) => a.numero - b.numero)
                .map((q) => (
                  <tr
                    key={q.id}
                    className={`border-b border-slate-100 ${
                      q.correto ? "bg-emerald-50/50" : "bg-rose-50/50"
                    }`}
                  >
                    <td className="p-2 font-medium">{q.numero}</td>
                    <td className="p-2 font-mono">{q.respostaAluno ?? "—"}</td>
                    <td className="p-2 font-mono">
                      {q.provaQuestao?.gabarito ?? "—"}
                    </td>
                    <td className="p-2 text-slate-700">
                      {q.provaQuestao
                        ? `${q.provaQuestao.materia} / ${q.provaQuestao.assunto}`
                        : `${getMateriaLabel(q.materiaId)} / ${getTemaLabel(q.materiaId, q.temaId)}`}
                    </td>
                    <td className="p-2 max-w-[200px] truncate text-xs text-slate-500" title={q.provaQuestao?.conhecimentoExigido ?? ""}>
                      {q.provaQuestao?.conhecimentoExigido ?? "—"}
                      {q.provaQuestao?.nivelDificuldade
                        ? ` · ${q.provaQuestao.nivelDificuldade}`
                        : ""}
                    </td>
                    <td className="p-2 text-right">{q.correto ? "✓" : "✗"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {exam.questionAttempts.every((q) => !q.respostaAluno) && (
          <p className="mt-3 text-xs text-amber-700">
            Este registro não incluiu seu gabarito (modo «só erros»). Na próxima vez, use «Meu
            gabarito» para ver acertos e erros questão a questão.
          </p>
        )}
      </Card>

      <Link href="/plano">
        <Button>Ver plano da semana</Button>
      </Link>
    </div>
  );
}
