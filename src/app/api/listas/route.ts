import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  MAX_QUESTOES_LISTA,
  mensagemErroLista,
  registrarListaExercicios,
} from "@/lib/lista-exercicios";

const createSchema = z.object({
  nome: z.string().min(1).max(120),
  data: z.string().min(1),
  totalQuestoes: z.number().int().min(1).max(MAX_QUESTOES_LISTA),
  apenasErros: z.array(z.number().int().positive()).min(1),
  checkInScore: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = createSchema.parse(await request.json());
    const result = await registrarListaExercicios({
      userId: session.userId,
      ...body,
    });
    return NextResponse.json({
      examId: result.exam.id,
      mensagem: result.diagnosis.mensagem,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }
    const code = e instanceof Error ? e.message : "ERRO";
    if (
      [
        "NOME_OBRIGATORIO",
        "DATA_OBRIGATORIA",
        "TOTAL_QUESTOES_INVALIDO",
        "ERROS_OBRIGATORIOS",
        "ERRO_FORA_INTERVALO",
        "LIMITE_SEMANAL",
      ].includes(code)
    ) {
      return NextResponse.json({ error: mensagemErroLista(code) }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao salvar lista" }, { status: 500 });
  }
}
