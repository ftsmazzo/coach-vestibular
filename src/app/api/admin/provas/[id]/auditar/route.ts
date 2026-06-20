import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  auditarClassificacaoQuestoes,
  formatarExportacaoAuditoria,
} from "@/lib/prova-auditoria";
import { extrairTrechosPorNumero } from "@/lib/prova-texto-parse";

const bodySchema = z.object({
  textoFonte: z.string().optional(),
  salvarTextoFonte: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    include: {
      questoes: { orderBy: { numero: "asc" } },
    },
  });

  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    body = {};
  }

  const texto =
    body.textoFonte?.trim() ||
    prova.textoFonte?.trim() ||
    "";

  if (body.salvarTextoFonte && body.textoFonte?.trim()) {
    await prisma.prova.update({
      where: { id: provaId },
      data: { textoFonte: body.textoFonte.trim().slice(0, 500_000) },
    });
  }

  const trechos =
    texto.length > 200 ? extrairTrechosPorNumero(texto) : new Map<number, string>();

  const questoesInput = prova.questoes.map((q) => ({
    numero: q.numero,
    idiomaVariante: q.idiomaVariante,
    materia: q.materia,
    assunto: q.assunto,
    conhecimentoExigido: q.conhecimentoExigido,
    nivelDificuldade: q.nivelDificuldade,
    areaBloco: q.areaBloco,
    observacoes: q.observacoes,
    enunciado: q.enunciado?.trim() || trechos.get(q.numero) || null,
  }));

  if (texto.length > 200) {
    const semEnunciado = prova.questoes.filter((q) => !q.enunciado?.trim());
    if (semEnunciado.length > 0) {
      await Promise.all(
        semEnunciado.map((q) => {
          const trecho = trechos.get(q.numero);
          if (!trecho || trecho.length < 40) return Promise.resolve();
          return prisma.provaQuestao.update({
            where: { id: q.id },
            data: { enunciado: trecho.slice(0, 6000) },
          });
        })
      );
    }
  }

  const alertas = auditarClassificacaoQuestoes(
    questoesInput,
    texto || null,
    prova.ordemIdiomasFaixa
  );
  const exportacao = formatarExportacaoAuditoria(prova.nome, alertas);

  return NextResponse.json({
    totalQuestoes: prova.questoes.length,
    suspeitas: alertas.length,
    temTextoFonte: Boolean(texto),
    textoFonteSalvo: Boolean(prova.textoFonte),
    alertas,
    exportacaoTexto: exportacao.texto,
    exportacaoCsv: exportacao.csv,
    numerosSuspeitos: exportacao.numeros,
  });
}
