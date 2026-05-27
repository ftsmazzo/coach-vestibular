import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card, LinkButton } from "@/components/ui";

/**
 * Listas de exercícios — módulo em construção.
 * A lista rápida (só números de erro) foi desativada: sem gabarito cruzado o diagnóstico não presta.
 */
export default async function ListasEmConstrucaoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Listas de exercícios</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Em breve: cadastro da lista com gabarito e cruzamento das suas respostas — igual ao
          catálogo de Atividades, com dados que valem para o plano.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <p className="text-sm font-medium text-amber-950">Por que pausamos a “lista rápida”?</p>
        <p className="mt-2 text-sm text-amber-900">
          Só anotar “errei 3, 5, 8” sem questões cadastradas nem gabarito oficial gera diagnóstico
          fraco — matéria chutada, assunto vazio. Você merece o mesmo rigor das provas do catálogo.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Estrutura planejada</h2>
        <ol className="mt-3 list-inside list-decimal space-y-3 text-sm text-slate-600">
          <li>
            <strong>Lista no catálogo (recomendado)</strong> — você envia PDF; a equipe cadastra
            questões, matéria, assunto e gabarito. Depois você usa{" "}
            <Link href="/provas" className="text-teal-700 underline">
              Atividades
            </Link>{" "}
            como hoje.
          </li>
          <li>
            <strong>Lista sua (privada)</strong> — você cola o gabarito da lista + suas respostas
            (ou só erros com matéria por questão); o app cruza e gera o mesmo tipo de análise das
            provas oficiais.
          </li>
          <li>
            <strong>Importação CSV</strong> — colunas número, acertou, matéria, tema para listas
            longas sem PDF.
          </li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Peso na jornada: treino (menor que prova oficial), desde que cada questão tenha
          classificação real.
        </p>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <LinkButton href="/provas" className="w-full sm:w-auto">
          Ir para Atividades
        </LinkButton>
        <LinkButton href="/listas/solicitar" variant="secondary" className="w-full sm:w-auto">
          Enviar PDF para o catálogo
        </LinkButton>
      </div>
    </div>
  );
}
