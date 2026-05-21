import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { extrairQuestoesComIA } from "@/lib/ai-extract-prova";
import { extractTextFromPdf } from "@/lib/pdf-text";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import {
  substituirQuestoesExtraidas,
  upsertQuestoesExtraidas,
} from "@/lib/prova-questoes-persist";

const bodySchema = z.object({
  texto: z.string().optional(),
  aplicar: z.boolean().default(false),
  /** substituir = apaga todas e recria; adicionar = só upsert (completar faltantes) */
  modo: z.enum(["substituir", "adicionar"]).default("substituir"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  let texto = "";
  let aplicar = false;
  let modo: "substituir" | "adicionar" = "substituir";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    aplicar = form.get("aplicar") === "true";
    modo = form.get("modo") === "adicionar" ? "adicionar" : "substituir";
    const textField = form.get("texto") as string | null;
    const file = form.get("file") as File | null;

    if (textField?.trim()) {
      texto = textField.trim();
    } else if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        texto = await extractTextFromPdf(buf);
      } else if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        texto = await buf.toString("utf-8");
      } else {
        return NextResponse.json(
          { error: "Formato não suportado. Use PDF ou TXT, ou cole o texto." },
          { status: 400 }
        );
      }
    }
  } else {
    const body = bodySchema.parse(await request.json());
    texto = body.texto ?? "";
    aplicar = body.aplicar;
    modo = body.modo;
  }

  if (!texto.trim()) {
    return NextResponse.json({ error: "Envie PDF, texto ou TXT da prova" }, { status: 400 });
  }

  try {
    const resultado = await extrairQuestoesComIA(texto, {
      nome: prova.nome,
      banca: prova.banca,
      ano: prova.ano,
      caderno: prova.caderno,
      totalEsperado: prova.totalQuestoes,
    });

    let adicionadas = 0;
    if (aplicar && resultado.questoes.length > 0) {
      if (modo === "adicionar") {
        adicionadas = await upsertQuestoesExtraidas(provaId, resultado.questoes);
      } else {
        await substituirQuestoesExtraidas(provaId, resultado.questoes);
        adicionadas = resultado.questoes.length;
      }
      await refreshProvaGabaritoFlag(provaId);
      const atualFonte = await prisma.prova.findUnique({
        where: { id: provaId },
        select: { textoFonte: true },
      });
      const textoSalvar =
        modo === "adicionar" && atualFonte?.textoFonte?.trim()
          ? `${atualFonte.textoFonte.trim()}\n\n--- trecho adicional ---\n\n${texto.trim()}`
          : texto.trim();
      await prisma.prova.update({
        where: { id: provaId },
        data: { textoFonte: textoSalvar.slice(0, 500_000) },
      });
    }

    return NextResponse.json({
      ...resultado,
      aplicado: aplicar,
      modo,
      adicionadas: aplicar ? adicionadas : 0,
      caracteresProcessados: texto.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na extração";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
