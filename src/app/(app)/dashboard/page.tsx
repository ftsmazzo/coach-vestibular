import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildJourneyInsight } from "@/lib/journey-insight";
import { getAnamneseStatus } from "@/lib/anamnese-motor";
import { AnamneseBanner } from "@/components/anamnese-banner";
import { DashboardHomeCopiloto } from "@/components/dashboard-home-copiloto";
import { JornadaResumoCard } from "@/components/jornada-resumo-card";
import { MensagemDiaCard } from "@/components/mensagem-dia";
import { Button } from "@/components/ui";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const [insight, anamnese] = await Promise.all([
    buildJourneyInsight(session.userId),
    getAnamneseStatus(session.userId),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">Olá, {session.name.split(" ")[0]}</p>
          <p className="text-xs text-slate-500">Seu copiloto de preparação — o que fazer agora</p>
        </div>
        <Link href="/provas" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Ver atividades</Button>
        </Link>
      </div>

      <AnamneseBanner anamnese={anamnese} />

      <DashboardHomeCopiloto insight={insight} />

      {/* Gamificação e comunidade — secundário */}
      <p className="text-center text-xs text-slate-500">
        Ranking e XP em{" "}
        <Link href="/comunidade" className="font-medium text-violet-700 underline">
          Comunidade
        </Link>
        {insight.missao?.temPlano && (
          <>
            {" "}
            · Plano detalhado em{" "}
            <Link href="/plano" className="font-medium text-teal-700 underline">
              Plano da semana
            </Link>
          </>
        )}
      </p>

      {/* Mensagem do dia — humano, abaixo da ação */}
      <MensagemDiaCard />

      {/* Números opcionais — não competem com a primeira dobra */}
      {insight.temDados && (
        <details className="rounded-xl border border-slate-200 bg-slate-50/50">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
            Ver números da jornada (detalhe)
          </summary>
          <div className="space-y-4 border-t border-slate-200 px-4 py-4">
            <JornadaResumoCard userId={session.userId} mode="HOME" />
            {insight.estado?.recoveryMode && (
              <p className="text-sm text-amber-800">
                Modo recuperação ativo no último registro — plano com metas menores.
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
