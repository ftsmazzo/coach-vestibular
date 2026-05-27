import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { CatalogoProvasGrid, type ProvaCatalogoItem } from "@/components/catalogo-provas-grid";

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

  const ultimaPorProvaId = new Map<
    string,
    { id: string; dataLabel: string; pctAcerto: number }
  >();
  const contagemPorProvaId = new Map<string, number>();

  for (const e of meusExams) {
    if (!e.provaId) continue;
    contagemPorProvaId.set(e.provaId, (contagemPorProvaId.get(e.provaId) ?? 0) + 1);
    if (!ultimaPorProvaId.has(e.provaId)) {
      const total = e.questionAttempts.length;
      const acertos = e.questionAttempts.filter((q) => q.correto).length;
      ultimaPorProvaId.set(e.provaId, {
        id: e.id,
        dataLabel: formatDataAplicacao(e.data),
        pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
      });
    }
  }

  const provas: ProvaCatalogoItem[] = provasRaw.map((p) => ({
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    banca: p.banca,
    ano: p.ano,
    minhasTentativas: contagemPorProvaId.get(p.id) ?? 0,
    ultimaTentativa: ultimaPorProvaId.get(p.id) ?? null,
  }));

  const metaLabel = [user?.vestibularAlvo, user?.metaProva].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Atividades</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
          Escolha a prova ou simulado que você fez e registre seu resultado. Suas falhas viram foco
          no plano e nas quests.
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

      <CatalogoProvasGrid provas={provas} />

      <p className="text-center text-sm text-slate-600">
        Lista de exercícios em casa?{" "}
        <Link href="/listas/nova" className="font-medium text-teal-700 underline">
          Registrar lista pessoal
        </Link>
        {" · "}
        <Link href="/listas/solicitar" className="font-medium text-teal-700 underline">
          Solicitar simulado no catálogo
        </Link>
      </p>
    </div>
  );
}
