import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { processAnamneseMessage } from "@/lib/anamnese-motor";

const schema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = schema.parse(await request.json());

  try {
    const { view, completed } = await processAnamneseMessage(session.userId, body.message);
    return NextResponse.json({ ...view, completed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg === "MENSAGEM_VAZIA") {
      return NextResponse.json({ error: "Digite uma resposta." }, { status: 400 });
    }
    throw e;
  }
}
