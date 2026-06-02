import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { fecharCiclo } from "@/lib/ciclo";

const schema = z.object({
  quizPct: z.number().min(0).max(100).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let quizPct: number | null = null;
  try {
    const body = schema.parse(await request.json());
    quizPct = body.quizPct ?? null;
  } catch {
    /* sem body = fecha sem quiz */
  }

  const r = await fecharCiclo(session.userId, { quizPct });
  if (!r) return NextResponse.json({ error: "Nenhum ciclo ativo" }, { status: 400 });

  return NextResponse.json({
    ok: true,
    resultado: r.resultado,
    proximoIndice: r.proximo.indice,
    mensagem: "Ciclo fechado. Novo ciclo aberto com base no seu momento atual.",
  });
}
