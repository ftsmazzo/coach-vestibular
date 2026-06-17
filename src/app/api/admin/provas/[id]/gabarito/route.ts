import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { faixaIdiomaProva, numeroNaFaixaIdioma } from "@/lib/prova-idioma";

const GABARITO_LETRA_OU_ANULADA = /^(\*|[A-Ea-e])$/;

/** Atualização em lote do gabarito por número da questão (e variante EN/ES quando aplicável). */
const schema = z.object({
  itens: z.array(
    z.object({
      numero: z.number().int().positive(),
      gabarito: z.string().regex(GABARITO_LETRA_OU_ANULADA).optional(),
      ingles: z.string().regex(GABARITO_LETRA_OU_ANULADA).optional(),
      espanhol: z.string().regex(GABARITO_LETRA_OU_ANULADA).optional(),
      idiomaVariante: z.enum(["COMUM", "INGLES", "ESPANHOL"]).optional(),
    })
  ),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const faixa = faixaIdiomaProva(prova);
  const { itens } = schema.parse(await request.json());
  let updated = 0;

  for (const item of itens) {
    const naFaixa = faixa && numeroNaFaixaIdioma(item.numero, faixa);

    if (naFaixa && (item.ingles || item.espanhol)) {
      if (item.ingles) {
        await prisma.provaQuestao.updateMany({
          where: { provaId, numero: item.numero, idiomaVariante: "INGLES" },
          data: { gabarito: item.ingles.toUpperCase() },
        });
        updated++;
      }
      if (item.espanhol) {
        await prisma.provaQuestao.updateMany({
          where: { provaId, numero: item.numero, idiomaVariante: "ESPANHOL" },
          data: { gabarito: item.espanhol.toUpperCase() },
        });
        updated++;
      }
      continue;
    }

    const letra = item.gabarito?.toUpperCase();
    if (!letra) continue;

    const variante = item.idiomaVariante ?? (naFaixa ? "INGLES" : "COMUM");
    await prisma.provaQuestao.updateMany({
      where: { provaId, numero: item.numero, idiomaVariante: variante },
      data: { gabarito: letra },
    });
    updated++;
  }

  const completo = await refreshProvaGabaritoFlag(provaId);
  return NextResponse.json({ ok: true, gabaritoCompleto: completo, updated });
}

/** Remove todos os gabaritos da prova (ex.: limpar preenchimento incorreto da IA) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const antes = await prisma.provaQuestao.count({
    where: { provaId, gabarito: { not: null } },
  });

  await prisma.provaQuestao.updateMany({
    where: { provaId },
    data: { gabarito: null },
  });

  const completo = await refreshProvaGabaritoFlag(provaId);
  return NextResponse.json({
    ok: true,
    removidos: antes,
    gabaritoCompleto: completo,
  });
}
