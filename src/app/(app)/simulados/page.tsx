import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Button, Badge } from "@/components/ui";

export default async function SimuladosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const exams = await prisma.exam.findMany({
    where: { userId: session.userId },
    orderBy: { data: "desc" },
    include: { questionAttempts: true, diagnosticSnapshot: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Meus registros</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/provas">
            <Button variant="secondary">Provas públicas</Button>
          </Link>
          <Link href="/simulados/upload">
            <Button variant="secondary">Upload (Fase 2)</Button>
          </Link>
          <Link href="/simulados/novo">
            <Button>Registrar resultado</Button>
          </Link>
        </div>
      </div>

      {exams.length === 0 ? (
        <Card>
          <p className="text-slate-600">Nenhum simulado registrado ainda.</p>
          <Link href="/simulados/novo" className="mt-4 inline-block">
            <Button>Registrar primeiro simulado</Button>
          </Link>
        </Card>
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => {
            const total = exam.questionAttempts.length;
            const acertos = exam.questionAttempts.filter((q) => q.correto).length;
            const pct = total > 0 ? Math.round((acertos / total) * 100) : 0;
            return (
              <li key={exam.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{exam.nome}</h2>
                    <p className="text-sm text-slate-500">
                      {exam.data.toLocaleDateString("pt-BR")} · {exam.banca} · {pct}% acertos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.recoveryMode && <Badge tone="warning">Recuperação</Badge>}
                    <Link href={`/simulados/${exam.id}`}>
                      <Button variant="ghost">Detalhes</Button>
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
