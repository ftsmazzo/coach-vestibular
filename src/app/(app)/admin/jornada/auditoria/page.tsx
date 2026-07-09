import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { auditarCoerenciaDadosJornada } from "@/lib/jornada-auditoria-dados";
import { formatarEvidenciaFocoAgregada } from "@/lib/jornada-evidencia-canonica";
import { AdminJornadaAuditoriaView } from "@/components/admin-jornada-auditoria-view";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ userId?: string; escopoId?: string }>;
};

export default async function AdminJornadaAuditoriaPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const { userId, escopoId } = await searchParams;

  if (!userId) {
    return (
      <div className="space-y-4">
        <Link href="/admin/usuarios" className="text-sm text-teal-700 hover:underline">
          ← Alunos e acesso
        </Link>
        <Card>
          <h1 className="text-xl font-bold text-slate-900">Auditoria da Jornada</h1>
          <p className="mt-2 text-sm text-slate-600">
            Selecione um aluno em{" "}
            <Link href="/admin/usuarios" className="font-medium text-teal-700 hover:underline">
              Alunos e acesso
            </Link>{" "}
            e use o botão <strong>Auditoria da Jornada</strong> na linha do aluno.
          </p>
        </Card>
      </div>
    );
  }

  const aluno = await prisma.user.findFirst({
    where: { id: userId, role: "STUDENT" },
    select: { id: true, name: true },
  });

  if (!aluno) {
    return (
      <div className="space-y-4">
        <Link href="/admin/usuarios" className="text-sm text-teal-700 hover:underline">
          ← Alunos e acesso
        </Link>
        <Card className="border-rose-200">
          <h1 className="text-xl font-bold text-slate-900">Aluno não encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Volte à lista de alunos e abra a auditoria pelo botão na linha correta.
          </p>
        </Card>
      </div>
    );
  }

  const auditoria = await auditarCoerenciaDadosJornada(userId, { escopoId });
  const textoEvidenciaAgregada = auditoria.evidenciaCanonicaFoco
    ? formatarEvidenciaFocoAgregada(auditoria.evidenciaCanonicaFoco)
    : null;

  return (
    <AdminJornadaAuditoriaView
      aluno={aluno}
      auditoria={auditoria}
      escopoId={escopoId}
      textoEvidenciaAgregada={textoEvidenciaAgregada}
    />
  );
}
