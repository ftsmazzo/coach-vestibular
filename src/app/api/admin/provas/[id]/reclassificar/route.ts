import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { extrairQuestoesComIA } from "@/lib/ai-extract-prova";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { ajustarMateriaPorIdiomaDoTexto } from "@/lib/prova-materia-ajuste";
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
  const textoIA = `Questão ${numero}\n\n${texto.trim()}`;

  try {
    const resultado = await extrairQuestoesComIA(textoIA, {
      nome: prova.nome,
      banca: prova.banca,
      ano: prova.ano,
      caderno: prova.caderno,
      totalEsperado: 1,
    });

    const daQuestao = resultado.questoes.filter((q) => q.numero === numero);
    const questoes =
      daQuestao.length > 0 ? daQuestao : resultado.questoes.slice(0, 1);

    if (questoes.length === 0) {
      return NextResponse.json(
        { error: "A IA não retornou classificação para esta questão. Cole mais texto do enunciado." },
        { status: 422 }
      );
    }

    const normalizadas = questoes.map((q) =>
      ajustarMateriaPorIdiomaDoTexto(textoIA, { ...q, numero })
    );
    await upsertQuestoesExtraidas(provaId, normalizadas);
    await refreshProvaGabaritoFlag(provaId);

    const salva = normalizadas[0];
    const atualizada = await prisma.provaQuestao.findUnique({
      where: { provaId_numero: { provaId, numero } },
    });

    return NextResponse.json({
      ok: true,
      numero,
      materia: atualizada?.materia ?? salva.materia,
      assunto: atualizada?.assunto ?? salva.assunto,
      conhecimentoExigido: atualizada?.conhecimentoExigido ?? salva.conhecimentoExigido,
      avisos: resultado.avisos,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na reclassificação";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
