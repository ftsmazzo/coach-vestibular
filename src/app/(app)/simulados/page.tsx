import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Últimos resultados</h1>
          <p className="mt-1 text-slate-600">
            Provas oficiais e simulados em um só lugar — use o filtro para ver só um tipo.
          </p>
        </div>
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
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{exam.nome}</h2>
                      <Badge tone={badgeTone}>{labelCategoriaRegistro(cat)}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Aplicada em {formatDataAplicacao(exam.data)} · {exam.banca} · {pct}% acertos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.recoveryMode && <Badge tone="warning">Recuperação</Badge>}
                    <Link href={`/simulados/${exam.id}`}>
                      <Button variant="ghost">Detalhes</Button>
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
