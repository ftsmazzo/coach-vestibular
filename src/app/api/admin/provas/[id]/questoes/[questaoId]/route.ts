import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { prisma } from "@/lib/prisma";
import { resolverQuestaoIdAposMateriaIdioma } from "@/lib/prova-idioma-par-server";
import {
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { sanitizarTextoProva, truncarTextoProva } from "@/lib/prova-texto-prova";
import {
  catalogoN1Valido,
  labelCatalogoN1,
  montarClassificacaoN1Manual,
  versaoLabelN1,
} from "@/lib/catalogos-n1-destino";

const patchSchema = z.object({
  enunciado: z.string().min(10).optional(),
  alternativas: z.string().nullable().optional(),
  areaBloco: z.string().nullable().optional(),
  materia: z.string().min(1).optional(),
  assunto: z.string().min(1).optional(),
  conhecimentoExigido: z.string().nullable().optional(),
  classificacaoN1CatalogoId: z.string().min(1).optional(),
  nivelDificuldade: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  gabarito: z.string().regex(/^[A-Ea-e]$/).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; questaoId: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId, questaoId } = await params;
  const body = patchSchema.parse(await request.json());

  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  const existente = await prisma.provaQuestao.findFirst({
    where: { id: questaoId, provaId },
  });
  if (!existente) {
    return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });
  }

  const n1Manual =
    body.classificacaoN1CatalogoId !== undefined
      ? (() => {
          if (!catalogoN1Valido(body.classificacaoN1CatalogoId!)) return null;
          return montarClassificacaoN1Manual(body.classificacaoN1CatalogoId!);
        })()
      : null;

  if (body.classificacaoN1CatalogoId !== undefined && !n1Manual) {
    return NextResponse.json({ error: "Catálogo N1 inválido." }, { status: 400 });
  }

  const materia =
    body.materia != null
      ? normalizarLabelMateria(body.materia)
      : n1Manual
        ? labelCatalogoN1(n1Manual.catalogoId)
        : existente.materia;
  const assunto =
    body.assunto != null
      ? normalizarLabelAssunto(materia, body.assunto)
      : n1Manual
        ? `N1: ${n1Manual.catalogoId}`
        : existente.assunto;

  const areaBloco =
    body.areaBloco !== undefined
      ? normalizarAreaBloco(body.areaBloco, materia)
      : existente.areaBloco;

  const questaoIdEfetivo =
    body.materia != null
      ? await resolverQuestaoIdAposMateriaIdioma(prova, questaoId, provaId, materia)
      : questaoId;

  const n1Patch = n1Manual
    ? {
        classificacaoN1Json: JSON.stringify(n1Manual),
        classificacaoVersao: versaoLabelN1(n1Manual),
        conhecimentoEscopoId: null,
        conhecimentoDominioId: null,
        conhecimentoExigido: null,
        classificacaoConfianca: null,
        classificacaoSecundariosJson: null,
        conceitosCanonicosJson: null,
      }
    : {};

  const atualizada = await prisma.provaQuestao.update({
    where: { id: questaoIdEfetivo },
    data: {
      ...n1Patch,
      ...(body.areaBloco !== undefined ? { areaBloco } : {}),
      materia,
      assunto,
      ...(body.conhecimentoExigido !== undefined && !n1Manual
        ? { conhecimentoExigido: body.conhecimentoExigido }
        : {}),
      ...(body.nivelDificuldade !== undefined
        ? { nivelDificuldade: body.nivelDificuldade }
        : {}),
      ...(body.observacoes !== undefined ? { observacoes: body.observacoes } : {}),
      ...(body.enunciado !== undefined
        ? { enunciado: truncarTextoProva(sanitizarTextoProva(body.enunciado)) || null }
        : {}),
      ...(body.alternativas !== undefined
        ? {
            alternativas: body.alternativas
              ? truncarTextoProva(sanitizarTextoProva(body.alternativas), 8000)
              : null,
          }
        : {}),
      ...(body.gabarito !== undefined
        ? { gabarito: body.gabarito?.toUpperCase() ?? null }
        : {}),
    },
  });

  if (body.enunciado !== undefined || body.alternativas !== undefined) {
    await prisma.prova.update({
      where: { id: provaId },
      data: { extracaoValidada: false },
    });
  }

  return NextResponse.json(atualizada);
}
