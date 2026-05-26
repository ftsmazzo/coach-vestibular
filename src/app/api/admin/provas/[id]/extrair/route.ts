import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { extrairQuestoesComIA, type QuestaoExtraida } from "@/lib/ai-extract-prova";
import { extractTextFromPdf } from "@/lib/pdf-text";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";
import { mesclarTextoParaBlocos } from "@/lib/prova-blocos-caderno";
import {
  atualizarQuestoesPorEtapa,
  substituirQuestoesExtraidas,
  upsertQuestoesExtraidas,
} from "@/lib/prova-questoes-persist";

const ETAPAS: EtapaExtracao[] = [
  "enunciados",
  "materia",
  "assunto",
  "conhecimento",
  "completo",
];

const bodySchema = z.object({
  texto: z.string().optional(),
  aplicar: z.boolean().default(false),
  modo: z.enum(["substituir", "adicionar"]).default("substituir"),
  etapa: z.enum(["enunciados", "materia", "assunto", "conhecimento", "completo"]).default("completo"),
  continuarDeBanco: z.boolean().default(false),
});

function parseEtapa(raw: FormDataEntryValue | string | null): EtapaExtracao {
  const s = String(raw ?? "completo");
  return ETAPAS.includes(s as EtapaExtracao) ? (s as EtapaExtracao) : "completo";
}

async function carregarBaseDoBanco(provaId: string): Promise<QuestaoExtraida[]> {
  const rows = await prisma.provaQuestao.findMany({
    where: { provaId },
    orderBy: { numero: "asc" },
  });
  return rows.map((r) => ({
    numero: r.numero,
    trechoEnunciado: r.enunciado?.trim() || "",
    materia: r.materia,
    assunto: r.assunto,
    areaBloco: r.areaBloco,
    conhecimentoExigido: r.conhecimentoExigido,
    nivelDificuldade: r.nivelDificuldade,
    observacoes: r.observacoes,
  }));
}

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
  let etapa: EtapaExtracao = "completo";
  let continuarDeBanco = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    aplicar = form.get("aplicar") === "true";
    modo = form.get("modo") === "adicionar" ? "adicionar" : "substituir";
    etapa = parseEtapa(form.get("etapa"));
    continuarDeBanco = form.get("continuarDeBanco") === "true";
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
    etapa = body.etapa;
    continuarDeBanco = body.continuarDeBanco;
  }

  const precisaTexto = etapa === "enunciados" || etapa === "completo";
  let baseInicial: QuestaoExtraida[] | undefined;

  if (continuarDeBanco || (!precisaTexto && !texto.trim())) {
    baseInicial = await carregarBaseDoBanco(provaId);
    if (baseInicial.length === 0) {
      return NextResponse.json(
        { error: "Não há questões no banco. Extraia e grave os enunciados primeiro." },
        { status: 400 }
      );
    }
    const semEnunciado = baseInicial.filter((q) => q.trechoEnunciado.length < 20);
    if (semEnunciado.length > 0 && etapa !== "enunciados") {
      return NextResponse.json(
        {
          error: `Questões sem enunciado no banco: nº ${semEnunciado
            .slice(0, 10)
            .map((q) => q.numero)
            .join(", ")}. Rode a etapa 1 antes.`,
        },
        { status: 400 }
      );
    }
  }

  if (precisaTexto && !texto.trim()) {
    return NextResponse.json(
      { error: "Envie PDF, texto ou TXT da prova para extrair enunciados." },
      { status: 400 }
    );
  }

  try {
    const fonteDb = await prisma.prova.findUnique({
      where: { id: provaId },
      select: { textoFonte: true },
    });
    const partesCaderno = [texto.trim(), fonteDb?.textoFonte?.trim()].filter(Boolean);
    const textoCaderno = partesCaderno.join("\n\n");
    const textoCadernoFinal =
      baseInicial?.length && etapa !== "enunciados"
        ? mesclarTextoParaBlocos(textoCaderno, baseInicial)
        : textoCaderno;

    const resultado = await extrairQuestoesComIA(
      texto,
      {
        nome: prova.nome,
        banca: prova.banca,
        ano: prova.ano,
        caderno: prova.caderno,
        totalEsperado: prova.totalQuestoes,
      },
      { etapa, baseInicial, textoCaderno: textoCadernoFinal || undefined }
    );

    let adicionadas = 0;
    if (aplicar && resultado.questoes.length > 0) {
      if (etapa === "completo" && modo === "substituir") {
        await substituirQuestoesExtraidas(provaId, resultado.questoes);
        adicionadas = resultado.questoes.length;
      } else if (etapa === "enunciados" && modo === "substituir") {
        await substituirQuestoesExtraidas(provaId, resultado.questoes);
        adicionadas = resultado.questoes.length;
      } else if (etapa === "completo" && modo === "adicionar") {
        adicionadas = await upsertQuestoesExtraidas(provaId, resultado.questoes);
      } else {
        adicionadas = await atualizarQuestoesPorEtapa(provaId, resultado.questoes, etapa);
      }

      await refreshProvaGabaritoFlag(provaId);

      if (texto.trim() && (etapa === "enunciados" || etapa === "completo")) {
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
    }

    return NextResponse.json({
      ...resultado,
      aplicado: aplicar,
      modo,
      etapa,
      adicionadas: aplicar ? adicionadas : 0,
      caracteresProcessados: texto.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na extração";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
