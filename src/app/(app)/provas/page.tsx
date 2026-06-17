import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { montarCatalogoAtividades } from "@/lib/catalogo-atividades";
import { CatalogoProvasGrid } from "@/components/catalogo-provas-grid";
import { Card, LinkButton } from "@/components/ui";

export default async function AtividadesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, provasRaw, meusExams] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { vestibularAlvo: true, metaProva: true },
    }),
    prisma.prova.findMany({
      where: { publicada: true },
      orderBy: [{ ano: "desc" }, { nome: "asc" }],
    }),
    prisma.exam.findMany({
      where: {
        userId: session.userId,
        provaId: { not: null },
      },
      include: { questionAttempts: true },
      orderBy: { data: "desc" },
    }),
  ]);

  const itens = montarCatalogoAtividades(
    provasRaw.map((p) => ({
      id: p.id,
      nome: p.nome,
      banca: p.banca,
      ano: p.ano,
      dia: p.dia,
      tipo: p.tipo,
      totalQuestoes: p.totalQuestoes,
      caderno: p.caderno,
      cadernoStoragePath: p.cadernoStoragePath,
    })),
    meusExams
  );

  const metaLabel = [user?.vestibularAlvo, user?.metaProva].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Atividades</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
          Catálogo de provas e simulados com questões classificadas (matéria e assunto). Quando você
          registra <strong>dia 1 e dia 2</strong> do mesmo ENEM/simulado, aparece{" "}
          <strong>uma atividade de 180 questões</strong> com análise unificada.
        </p>
      </div>

      {metaLabel && (
        <p className="text-sm text-teal-900">
          <span className="font-medium">Sua meta:</span> {metaLabel}.{" "}
          <Link href="/perfil" className="font-medium text-teal-700 underline">
            Editar
          </Link>
        </p>
      )}

      <CatalogoProvasGrid itens={itens} />

      <Card className="border-dashed border-slate-200 bg-slate-50/80">
        <p className="text-sm text-slate-600">
          Não achou seu simulado ou lista do cursinho? Envie o PDF — a equipe cadastra as questões e
          publica aqui.
        </p>
        <LinkButton href="/listas/solicitar" variant="secondary" className="mt-3">
          Solicitar publicação no catálogo
        </LinkButton>
      </Card>
    </div>
  );
}
