import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { classificarQuestaoUnica } from "@/lib/prova-classificacao-motor";
import { modeloClassificacao } from "@/lib/openai-modelos";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { upsertQuestoesExtraidas } from "@/lib/prova-questoes-persist";

const bodySchema = z.object({
  numero: z.number().int().positive(),
  texto: z.string().min(15, "Cole o enunciado completo da questão"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  const { numero, texto } = bodySchema.parse(await request.json());
  const enunciado = texto.trim();

  const existente = await prisma.provaQuestao.findUnique({
    where: { provaId_numero: { provaId, numero } },
  });

  try {
    const salva = await classificarQuestaoUnica({
      numero,
      trechoEnunciado: enunciado,
      materia: "A classificar",
      assunto: "A classificar",
      areaBloco: existente?.areaBloco ?? null,
      conhecimentoExigido: null,
      nivelDificuldade: null,
      observacoes: null,
    });

    if (salva.materia === "A classificar" || salva.assunto === "A classificar") {
      return NextResponse.json(
        { error: "A IA não classificou esta questão. Cole mais texto do enunciado." },
        { status: 422 }
      );
    }

    await upsertQuestoesExtraidas(provaId, [salva]);
    await refreshProvaGabaritoFlag(provaId);

    const atualizada = await prisma.provaQuestao.findUnique({
      where: { provaId_numero: { provaId, numero } },
    });

    return NextResponse.json({
      ok: true,
      numero,
      modeloUsado: modeloClassificacao(),
      materia: atualizada?.materia ?? salva.materia,
      assunto: atualizada?.assunto ?? salva.assunto,
      conhecimentoExigido: atualizada?.conhecimentoExigido ?? salva.conhecimentoExigido,
      nivelDificuldade: atualizada?.nivelDificuldade ?? salva.nivelDificuldade,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na reclassificação";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
