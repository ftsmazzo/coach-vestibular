import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { sincronizarSnapshotsClassificacaoAttemptsDaProva } from "@/lib/jornada-pendencias-classificacao";
import { executarFaseN1Prova } from "@/lib/prova-classificacao-fases";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

export const maxDuration = 600;

const bodySchema = z
  .object({
    apenasFaltantes: z.boolean().optional(),
    reprocessarTodas: z.boolean().optional(),
    preservarManuais: z.boolean().optional(),
    forcarTudo: z.boolean().optional(),
  })
  .refine(
    (b) => {
      const flags = [b.apenasFaltantes, b.reprocessarTodas, b.forcarTudo].filter(Boolean).length;
      return flags <= 1;
    },
    { message: "Use apenas um modo: apenasFaltantes, reprocessarTodas ou forcarTudo." }
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const body = bodySchema.parse(await request.json().catch(() => ({})));

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor." },
      { status: 503 }
    );
  }

  try {
    const resultado = await executarFaseN1Prova(provaId, body);
    await refreshProvaGabaritoFlag(provaId);
    const sync = await sincronizarSnapshotsClassificacaoAttemptsDaProva(provaId);
    revalidatePath("/dashboard", "layout");
    revalidatePath("/plano", "layout");

    const modo = body.forcarTudo
      ? "forcarTudo"
      : body.reprocessarTodas
        ? "reprocessarTodas"
        : "apenasFaltantes";

    return NextResponse.json({
      ...resultado,
      sync,
      fase: "N1",
      modo,
      mensagem:
        `Fase N1 (${modo}): ${resultado.ok}/${resultado.total} com catálogo destino. ` +
        `Alterados ${resultado.n1Alterados ?? 0} · puladas ${resultado.puladas ?? 0} ` +
        `(manuais preservadas ${resultado.manuaisPreservadas ?? 0}).`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na fase N1";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
