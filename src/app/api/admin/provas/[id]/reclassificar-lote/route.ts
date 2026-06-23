import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reclassificarProvaInteiraComCatalogo } from "@/lib/prova-classificacao-catalogo";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

export const maxDuration = 600;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor." },
      { status: 503 }
    );
  }

  try {
    const resultado = await reclassificarProvaInteiraComCatalogo(provaId, {
      banca: prova.banca,
    });

    await refreshProvaGabaritoFlag(provaId);

    return NextResponse.json({
      ok: true,
      ...resultado,
      mensagem:
        resultado.classificadas > 0
          ? `${resultado.classificadas}/${resultado.total} questão(ões) com escopo N2. ${resultado.processadas} linha(s) atualizadas no banco.`
          : "Nenhuma questão classificada — verifique se há enunciado ou resumo salvo.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na reclassificação em lote";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
