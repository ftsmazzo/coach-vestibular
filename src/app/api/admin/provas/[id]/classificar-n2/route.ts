import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { executarFaseN2Prova } from "@/lib/prova-classificacao-fases";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

export const maxDuration = 600;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    apenasFaltantes?: boolean;
    numerosQuestao?: number[];
  };

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor." },
      { status: 503 }
    );
  }

  try {
    const numeros =
      Array.isArray(body.numerosQuestao) && body.numerosQuestao.length > 0
        ? body.numerosQuestao.filter((n) => Number.isFinite(n) && n > 0).map(Math.trunc)
        : undefined;

    const resultado = await executarFaseN2Prova(provaId, {
      apenasSemEscopoReal: !numeros?.length && body.apenasFaltantes === true,
      numerosQuestao: numeros,
    });
    await refreshProvaGabaritoFlag(provaId);
    const prefixo = numeros?.length
      ? `N2 (Q${numeros.join(", Q")})`
      : body.apenasFaltantes
        ? "N2 (só faltantes)"
        : "Fase N2";
    return NextResponse.json({
      ...resultado,
      fase: "N2",
      mensagem: `${prefixo}: ${resultado.ok}/${resultado.processadas} com escopo real (de ${resultado.total} no banco).`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na fase N2";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
