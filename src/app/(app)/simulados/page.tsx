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
            <strong>Prova ou simulado do catálogo?</strong> Use{" "}
            <Link href="/provas" className="font-medium text-teal-700 underline">
              Atividades
            </Link>{" "}
            — lá cada questão já tem matéria e assunto cadastrados pela equipe.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Link href="/provas" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Registrar resultado</Button>
          </Link>
          <Link href="/listas/nova" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Lista rápida (só erros)
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">O que é “lista rápida”?</h2>
        <p className="mt-2 text-sm text-slate-600">
          É um atalho quando você <strong>não tem</strong> a prova no catálogo: você informa só
          quantas questões errou e o app estima a matéria pelo número da questão.{" "}
          <strong>Não dá para anexar PDF nem cadastrar enunciados aqui.</strong>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Para diagnóstico completo (matéria, assunto, quests certinhas), a prova precisa estar em
          Atividades — feita pela equipe a partir do material que você envia.
        </p>
        <LinkButton href="/listas/solicitar" variant="secondary" className="mt-3">
          Enviar PDF e pedir publicação em Atividades
        </LinkButton>
      </Card>

      {listas.length === 0 ? (
        <Card>
          <p className="text-slate-600">Você ainda não registrou nenhuma lista pessoal.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/provas">
              <Button>Ir para Atividades</Button>
            </Link>
            <Link href="/listas/nova">
              <Button variant="secondary">Lista rápida (só erros)</Button>
            </Link>
          </div>
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
