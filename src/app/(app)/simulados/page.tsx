import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { abreviarNomeProva } from "@/lib/prova-label";
import { AtividadeCard } from "@/components/atividade-card";
import { Card, Button, LinkButton } from "@/components/ui";
import { ExcluirRegistroButton } from "@/components/excluir-registro-button";

export default async function MinhasListasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const listas = await prisma.exam.findMany({
    where: {
      userId: session.userId,
      provaId: null,
    },
    orderBy: { data: "desc" },
    include: { questionAttempts: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Minhas listas</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Listas de exercícios que você registra aqui entram como treino — peso menor na jornada.
            Simulados e provas oficiais ficam em{" "}
            <Link href="/provas" className="font-medium text-teal-700 underline">
              Atividades
            </Link>
            .
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Link href="/provas" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Atividades
            </Button>
          </Link>
          <Link href="/listas/nova" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">+ Nova lista</Button>
          </Link>
        </div>
      </div>

      <Card className="border-amber-100 bg-amber-50/60">
        <p className="text-sm text-amber-950">
          <strong>Simulado que não está no catálogo?</strong> Envie o PDF para a equipe publicar em
          Atividades.
        </p>
        <LinkButton href="/listas/solicitar" variant="secondary" className="mt-3">
          Solicitar simulado
        </LinkButton>
      </Card>

      {listas.length === 0 ? (
        <Card>
          <p className="text-slate-600">Você ainda não registrou nenhuma lista pessoal.</p>
          <Link href="/listas/nova" className="mt-4 inline-block">
            <Button>Registrar primeira lista</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {listas.map((exam) => {
              const pct = pctAcertoRegistro(exam.questionAttempts);
              return (
                <div key={exam.id} className="space-y-2">
                  <AtividadeCard
                    titulo={abreviarNomeProva(exam.nome, 42)}
                    subtitulo={`${formatDataAplicacao(exam.data)} · Lista pessoal`}
                    tipoAtividade="lista"
                    pct={pct}
                    analiseHref={`/simulados/${exam.id}`}
                    dadosHref={`/simulados/${exam.id}`}
                    terceiroHref="/quests"
                    terceiroLabel="Quests"
                  />
                  <div className="flex justify-end">
                    <ExcluirRegistroButton examId={exam.id} nome={exam.nome} variant="danger" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
