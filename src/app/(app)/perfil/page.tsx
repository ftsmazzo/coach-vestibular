import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildResumoJornada } from "@/lib/jornada";
import { nomePublicoRanking } from "@/lib/apelido-ranking";
import { ConquistasGrid } from "@/components/conquistas-grid";
import { PerfilEditarForm } from "@/components/perfil-editar-form";
import { XpComoGanhar } from "@/components/xp-como-ganhar";
import { XpRecentes } from "@/components/xp-recentes";
import { Card, Badge } from "@/components/ui";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const [user, jornada] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        telefone: true,
        nomeExibicaoRanking: true,
        vestibularAlvo: true,
        metaProva: true,
        xp: true,
      },
    }),
    buildResumoJornada(session.userId),
  ]);

  if (!user) redirect("/login");

  const nomeNoRanking = nomePublicoRanking(user);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-teal-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Seu perfil</h1>
        <p className="mt-1 text-slate-600">
          Edite seus dados, escolha como aparece no ranking e ajuste sua meta.
        </p>
      </div>

      <Card className="border-violet-200 bg-violet-50/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-3xl font-bold text-violet-900">{user.xp} XP</span>
            <p className="mt-1 text-sm text-slate-600">
              No ranking você aparece como: <strong>{nomeNoRanking}</strong>
            </p>
          </div>
          <Link href="/comunidade" className="text-sm font-medium text-violet-700 hover:underline">
            Ver ranking →
          </Link>
        </div>
      </Card>

      <PerfilEditarForm
        inicial={{
          name: user.name,
          email: user.email,
          telefone: user.telefone,
          nomeExibicaoRanking: user.nomeExibicaoRanking,
          vestibularAlvo: user.vestibularAlvo ?? "Medicina",
          metaProva: user.metaProva ?? "",
        }}
      />

      {jornada.bancasPrioritarias.length > 0 && (
        <Card className="border-teal-100 bg-teal-50/30">
          <p className="text-sm text-teal-900">
            <strong>Priorização ativa:</strong> registros destas bancas pesam mais na jornada e no
            plano:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {jornada.bancasPrioritarias.map((b) => (
              <Badge key={b} tone="success">
                {b}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <XpComoGanhar />
      <XpRecentes userId={session.userId} />
      <ConquistasGrid userId={session.userId} />
    </div>
  );
}
