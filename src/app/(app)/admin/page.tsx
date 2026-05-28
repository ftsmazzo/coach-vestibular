import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statsQuestoesProva } from "@/lib/prova-stats";
import { STATUS_SOLICITACAO_PENDENTE } from "@/lib/solicitacao-simulado";
import { Card, Button, Badge } from "@/components/ui";

export default async function AdminHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const [provas, alunos, tentativas, publicadas, sugestoesPendentes, solicitacoesPendentes] =
    await Promise.all([
    prisma.prova.findMany({
      include: { questoes: { select: { numero: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.exam.count(),
    prisma.prova.count({ where: { publicada: true } }),
    prisma.sugestaoClassificacao.count({ where: { status: "PENDENTE" } }),
    prisma.uploadJob.count({ where: { status: STATUS_SOLICITACAO_PENDENTE } }),
  ]);

  const incompletas = provas.filter((p) => {
    const s = statsQuestoesProva(p.questoes, p.totalQuestoes);
    return s.incompleto || !p.gabaritoCompleto;
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="neutral">Área administrativa</Badge>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Painel admin</h1>
        <p className="text-slate-600">
          Cadastre provas, questões e gabaritos. Alunos usam outra área (catálogo, resultados,
          plano).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Provas no banco</p>
          <p className="text-3xl font-bold text-slate-900">{provas.length}</p>
          <p className="text-xs text-slate-500">{publicadas} publicadas</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Alunos cadastrados</p>
          <p className="text-3xl font-bold text-slate-900">{alunos}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Registros de alunos</p>
          <p className="text-3xl font-bold text-slate-900">{tentativas}</p>
          <p className="text-xs text-slate-500">tentativas / exams</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Provas a revisar</p>
          <p className="text-3xl font-bold text-amber-700">{incompletas.length}</p>
          <p className="text-xs text-slate-500">incompletas ou sem gabarito</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/provas">
          <Button>Banco de provas</Button>
        </Link>
        <Link href="/admin/usuarios">
          <Button variant="secondary">Alunos e acesso</Button>
        </Link>
        <Link href="/admin/sugestoes">
          <Button variant="secondary">
            Sugestões{sugestoesPendentes > 0 ? ` (${sugestoesPendentes})` : ""}
          </Button>
        </Link>
        <Link href="/admin/solicitacoes">
          <Button variant={solicitacoesPendentes > 0 ? "primary" : "secondary"}>
            PDFs solicitados
            {solicitacoesPendentes > 0 ? ` (${solicitacoesPendentes})` : ""}
          </Button>
        </Link>
        <Link href="/admin/convites">
          <Button variant="ghost">Convites</Button>
        </Link>
        <Link href="/provas">
          <Button variant="ghost">Ver catálogo como aluno</Button>
        </Link>
      </div>

      {solicitacoesPendentes > 0 && (
        <Card className="border-amber-200 bg-amber-50/80">
          <h2 className="font-semibold text-amber-900">PDFs aguardando cadastro</h2>
          <p className="mt-1 text-sm text-amber-800">
            {solicitacoesPendentes} solicitação(ões) de alunos com material para publicar no
            catálogo.
          </p>
          <Link href="/admin/solicitacoes" className="mt-3 inline-block text-sm font-medium text-teal-700 underline">
            Ver fila →
          </Link>
        </Card>
      )}

      {incompletas.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-900">Precisa de atenção</h2>
          <ul className="mt-3 space-y-2">
            {incompletas.slice(0, 8).map((p) => {
              const s = statsQuestoesProva(p.questoes, p.totalQuestoes);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {p.nome}
                    {!p.publicada && (
                      <span className="ml-2">
                        <Badge tone="warning">rascunho</Badge>
                      </span>
                    )}
                  </span>
                  <span className="text-slate-500">
                    {s.cadastradas}/{p.totalQuestoes} questões
                    {!p.gabaritoCompleto ? " · gabarito incompleto" : ""}
                  </span>
                  <Link href={`/admin/provas/${p.id}`} className="text-teal-700 hover:underline">
                    Editar →
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
