import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  auditarCoerenciaDadosJornada,
  type AuditoriaDadosJornadaComFoco,
} from "@/lib/jornada-auditoria-dados";
import {
  evidenciaCanonicaFocoDeAgregado,
  formatarEvidenciaFocoAgregada,
} from "@/lib/jornada-evidencia-canonica";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  userId: z.string().min(1),
  escopoId: z.string().min(1).optional(),
});

/** Auditoria canônica de coerência entre provas, diagnóstico e Jornada. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get("userId"),
    escopoId: url.searchParams.get("escopoId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe userId. Opcional: escopoId." }, { status: 400 });
  }

  const { userId, escopoId } = parsed.data;

  const aluno = await prisma.user.findFirst({
    where: { id: userId, role: "STUDENT" },
    select: { id: true, name: true },
  });
  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  }

  const auditoria = (await auditarCoerenciaDadosJornada(userId, {
    escopoId,
  })) as AuditoriaDadosJornadaComFoco;

  const resposta: Record<string, unknown> = {
    ...auditoria,
    aluno: { id: aluno.id, name: aluno.name },
    temDivergencias: auditoria.divergencias.length > 0,
  };

  if (auditoria.escopoFiltrado) {
    const foco = evidenciaCanonicaFocoDeAgregado(auditoria.escopoFiltrado);
    resposta.evidenciaCanonicaFoco = foco;
    resposta.textoEvidenciaAgregada = formatarEvidenciaFocoAgregada(foco);
  }

  return NextResponse.json(resposta);
}
