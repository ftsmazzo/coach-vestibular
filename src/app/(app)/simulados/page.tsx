import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { labelModoUso } from "@/lib/modo-uso";
import {
  categoriaDoRegistro,
  filtroRegistrosFromSearchParam,
  labelCategoriaRegistro,
  registroPassaFiltro,
} from "@/lib/prova-tipo";
import { Card, Button, Badge } from "@/components/ui";
import { FiltroRegistrosTabs } from "@/components/filtro-registros-tabs";
import { ExcluirRegistroButton } from "@/components/excluir-registro-button";

interface PageProps {
  searchParams: Promise<{ filtro?: string }>;
}

export default async function SimuladosPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { filtro: filtroParam } = await searchParams;
  const filtro = filtroRegistrosFromSearchParam(filtroParam);

  const exams = await prisma.exam.findMany({
    where: { userId: session.userId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: true,
      diagnosticSnapshot: true,
      prova: { select: { tipo: true } },
    },
  });

  const counts = {
    todos: exams.length,
    provas: exams.filter((e) => registroPassaFiltro(e, "provas")).length,
    simulados: exams.filter((e) => registroPassaFiltro(e, "simulados")).length,
  };

  const lista = exams.filter((e) => registroPassaFiltro(e, filtro));

  const emptyMsg =
    filtro === "provas"
      ? "Nenhuma prova oficial registrada ainda (ENEM, vestibular UFU, etc.)."
      : filtro === "simulados"
        ? "Nenhum simulado de cursinho registrado ainda."
        : "Nenhum resultado registrado ainda.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Últimos resultados</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Provas oficiais e simulados em um só lugar — use o filtro para ver só um tipo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Link href="/provas" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Provas públicas
            </Button>
          </Link>
          <Link href="/simulados/novo" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Registrar resultado</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <FiltroRegistrosTabs basePath="/simulados" filtro={filtro} counts={counts} />
        <p className="mt-3 text-sm text-slate-600">
          {filtro === "provas" && (
            <>
              <strong>Provas oficiais</strong> — ENEM, vestibulares (ex.: UFU). Base do diagnóstico
              de focos.
            </>
          )}
          {filtro === "simulados" && (
            <>
              <strong>Simulados</strong> — cursinho, escola, treinos. Termômetro da evolução nos
              temas das oficiais.
            </>
          )}
          {filtro === "todos" && (
            <>
              <strong>Todos</strong> — {counts.provas} prova{counts.provas !== 1 ? "s" : ""}{" "}
              oficial{counts.provas !== 1 ? "is" : ""} e {counts.simulados} simulado
              {counts.simulados !== 1 ? "s" : ""}.
            </>
          )}
        </p>
      </div>

      {lista.length === 0 ? (
        <Card>
          <p className="text-slate-600">{emptyMsg}</p>
          <Link href="/provas" className="mt-3 inline-block text-sm text-teal-700 hover:underline">
            Ver catálogo de provas →
          </Link>
          <Link href="/simulados/novo" className="mt-4 inline-block">
            <Button>Registrar resultado</Button>
          </Link>
        </Card>
      ) : (
        <ul className="space-y-3">
          {lista.map((exam) => {
            const pct = pctAcertoRegistro(exam.questionAttempts);
            const cat = categoriaDoRegistro(exam);
            const badgeTone = cat === "prova_oficial" ? "success" : "neutral";
            return (
              <li key={exam.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{exam.nome}</h2>
                      <Badge tone={badgeTone}>{labelCategoriaRegistro(cat)}</Badge>
                      <Badge tone="neutral">{labelModoUso(exam.modoUso)}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Aplicada em {formatDataAplicacao(exam.data)} · {exam.banca} · {pct}% acertos
                    </p>
                    {exam.provaId && (
                      <Link
                        href={`/provas/${exam.provaId}/historico`}
                        className="text-xs text-teal-700 hover:underline"
                      >
                        Histórico desta prova no catálogo →
                      </Link>
                    )}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {exam.recoveryMode && <Badge tone="warning">Recuperação</Badge>}
                    <Link href={`/simulados/${exam.id}`} className="flex-1 sm:flex-none">
                      <Button variant="ghost" className="w-full sm:w-auto">
                        Detalhes
                      </Button>
                    </Link>
                    <ExcluirRegistroButton examId={exam.id} nome={exam.nome} />
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
