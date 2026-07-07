import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  coletarPendenciasClassificacaoJornada,
  sincronizarSnapshotsClassificacaoAttemptsDoUsuario,
} from "@/lib/jornada-pendencias-classificacao";
import { revalidatePath } from "next/cache";

const querySchema = z.object({
  userId: z.string().min(1),
  provaId: z.string().min(1).optional(),
  sincronizar: z.enum(["true", "false"]).optional(),
});

/** Diagnóstico admin: pendências N1/N2/N3 por prova e sincronização opcional attempt ← ProvaQuestao. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get("userId"),
    provaId: url.searchParams.get("provaId") ?? undefined,
    sincronizar: url.searchParams.get("sincronizar") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe userId. Opcional: provaId, sincronizar=true." },
      { status: 400 }
    );
  }

  const { userId, provaId, sincronizar } = parsed.data;

  let sync = null;
  if (sincronizar === "true") {
    sync = await sincronizarSnapshotsClassificacaoAttemptsDoUsuario(userId, provaId);
    revalidatePath("/dashboard", "layout");
    revalidatePath("/plano", "layout");
  }

  const pendencias = await coletarPendenciasClassificacaoJornada(userId);

  return NextResponse.json({
    userId,
    pendencias,
    sync,
    pctExibicao: Math.round(pendencias.pctQuestoesComN1N2N3 * 100),
  });
}
