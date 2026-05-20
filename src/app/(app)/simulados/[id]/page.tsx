import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMateriaLabel, getTemaLabel, getTipoErroLabel } from "@/lib/taxonomy";
import { Card, Button, Badge } from "@/components/ui";

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
        <Link href="/dashboard">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </div>

      {exam.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação ativado</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Plano semanal mais leve gerado automaticamente.
          </p>
        </Card>
      )}

      {snapshot && (
        <Card>
          <h2 className="mb-2 font-semibold">Diagnóstico</h2>
          <p className="text-slate-700">{snapshot.mensagem}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {focos.map((f: { label: string; prioridade: string }, i: number) => (
              <Badge key={i} tone={f.prioridade === "alta" ? "danger" : "warning"}>
                {f.label}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">Questões</h2>
        <ul className="space-y-2 text-sm">
          {exam.questionAttempts
            .sort((a, b) => a.numero - b.numero)
            .map((q) => (
              <li
                key={q.id}
                className={`flex justify-between rounded-lg px-2 py-1 ${
                  q.correto ? "bg-emerald-50" : "bg-rose-50"
                }`}
              >
                <span>
                  Q{q.numero}
                  {q.provaQuestao ? (
                    <>
                      {" "}
                      — {q.provaQuestao.materia} / {q.provaQuestao.assunto}
                      {q.respostaAluno && (
                        <span className="text-slate-500">
                          {" "}
                          (sua: {q.respostaAluno}
                          {q.provaQuestao.gabarito ? ` · gab: ${q.provaQuestao.gabarito}` : ""})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {" "}
                      — {getMateriaLabel(q.materiaId)} / {getTemaLabel(q.materiaId, q.temaId)}
                    </>
                  )}
                  {!q.correto && q.tipoErro && (
                    <span className="text-slate-500"> ({getTipoErroLabel(q.tipoErro)})</span>
                  )}
                </span>
                <span>{q.correto ? "✓" : "✗"}</span>
              </li>
            ))}
        </ul>
      </Card>

      <Link href="/plano">
        <Button>Ver plano da semana</Button>
      </Link>
    </div>
  );
}
