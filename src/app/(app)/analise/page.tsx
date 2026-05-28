import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildJornadaGraficos } from "@/lib/jornada-graficos";
import { JornadaGraficos } from "@/components/jornada-graficos";
import { Card, LinkButton } from "@/components/ui";

export default async function AnalisePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const data = await buildJornadaGraficos(session.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Análise da jornada</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Os números por trás do seu copiloto — como você erra e quais conhecimentos mais pesam.
          Para o <strong>o que fazer</strong>, veja o{" "}
          <Link href="/plano" className="font-medium text-teal-700 hover:underline">
            Plano
          </Link>{" "}
          e as{" "}
          <Link href="/quests#agora" className="font-medium text-teal-700 hover:underline">
            Quests
          </Link>
          .
        </p>
      </div>

      {!data.temDados ? (
        <Card className="border-dashed border-slate-200">
          <p className="text-sm text-slate-600">
            Ainda não há registros para gerar gráficos. Registre uma atividade com gabarito e, de
            preferência, classifique o motivo dos erros.
          </p>
          <LinkButton href="/provas" className="mt-4 w-full sm:w-auto">
            Ver atividades
          </LinkButton>
        </Card>
      ) : (
        <JornadaGraficos data={data} />
      )}
    </div>
  );
}
