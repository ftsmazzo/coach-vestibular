import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { registrarTentativaProva } from "@/lib/prova-attempt";

const schema = z.object({
  provaId: z.string(),
  data: z.string().optional(),
  checkInScore: z.number().int().min(1).max(5).optional(),
  nota: z.number().optional(),
  /** Uma linha por questão: 1,C */
  gabaritoAluno: z.string().optional(),
  respostas: z.string().optional(),
  apenasErros: z.array(z.number().int().positive()).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const temGabarito =
      Boolean(body.gabaritoAluno?.trim()) || Boolean(body.respostas?.trim());
    const temErros = Boolean(body.apenasErros?.length);
    if (!temGabarito && !temErros) {
      return NextResponse.json(
        {
          error:
            "Informe seu gabarito (número e letra por questão), uma sequência de respostas ou a lista de erros",
        },
        { status: 400 }
      );
    }

    const result = await registrarTentativaProva({
      userId: session.userId,
      ...body,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg === "PROVA_NOT_FOUND") {
      return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
    }
    if (msg === "PROVA_NOT_PUBLISHED") {
      return NextResponse.json({ error: "Prova não disponível" }, { status: 403 });
    }
    if (msg === "GABARITO_ALUNO_OBRIGATORIO") {
      return NextResponse.json(
        { error: "Informe seu gabarito ou os números das questões erradas" },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao registrar tentativa" }, { status: 500 });
  }
}
