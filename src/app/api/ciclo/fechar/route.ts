import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { fecharCiclo } from "@/lib/ciclo";

const schema = z.object({
  quizPct: z.number().min(0).max(100).nullable().optional(),
  quizAcertos: z.number().int().min(0).optional(),
  quizTotal: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let quizPct: number | null = null;
  let quizAcertos = 0;
  let quizTotal = 0;
  try {
    const body = schema.parse(await request.json());
    quizPct = body.quizPct ?? null;
    quizAcertos = body.quizAcertos ?? 0;
    quizTotal = body.quizTotal ?? 0;
  } catch {
    /* sem body = fecha sem quiz */
  }

  const r = await fecharCiclo(session.userId, { quizPct, quizAcertos, quizTotal });
  if (!r) return NextResponse.json({ error: "Nenhum ciclo ativo" }, { status: 400 });

  return NextResponse.json({
    ok: true,
    resultado: r.resultado,
    proximoIndice: r.proximo.indice,
    mensagem: "Ciclo fechado. Novo ciclo aberto com base no seu momento atual.",
  });
}
