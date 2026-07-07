import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  CONFIRM_RESET_ANAMNESE,
  CONFIRM_RESET_PLANO_JORNADA,
  CONFIRM_RESET_JORNADA,
  executarResetJornadaAdmin,
  type JornadaResetTipo,
} from "@/lib/jornada-reset-admin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.discriminatedUnion("tipo", [
  z.object({
    userId: z.string().min(1),
    tipo: z.literal("ANAMNESE"),
    confirmar: z.literal(CONFIRM_RESET_ANAMNESE),
  }),
  z.object({
    userId: z.string().min(1),
    tipo: z.literal("PLANO_JORNADA"),
    confirmar: z.literal(CONFIRM_RESET_PLANO_JORNADA),
  }),
  z.object({
    userId: z.string().min(1),
    tipo: z.literal("JORNADA"),
    confirmar: z.literal(CONFIRM_RESET_JORNADA),
  }),
]);

const MENSAGENS: Record<JornadaResetTipo, (nome: string) => string> = {
  ANAMNESE: (nome) =>
    `Anamnese de ${nome} apagada. Provas, jornada, plano e diagnóstico foram preservados.`,
  PLANO_JORNADA: (nome) =>
    `Plano semanal e quests da Jornada de ${nome} removidos. Diagnóstico inicial, ciclos e anamnese preservados.`,
  JORNADA: (nome) =>
    `Jornada de ${nome} zerada (diagnóstico, ciclos, plano e quests). Anamnese e provas preservadas.`,
};

/** Reset administrativo isolado: anamnese, plano semanal da Jornada ou jornada completa. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Body inválido. Use tipo + confirmar literal (RESET_ANAMNESE | RESET_PLANO_JORNADA | RESET_JORNADA).",
        detalhes: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { userId, tipo, confirmar } = parsed.data;

  const aluno = await prisma.user.findFirst({
    where: { id: userId, role: "STUDENT" },
    select: { id: true, name: true },
  });
  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  }

  const resultado = await executarResetJornadaAdmin(userId, tipo, confirmar);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/plano", "layout");
  revalidatePath("/quests", "layout");
  if (tipo === "ANAMNESE") {
    revalidatePath("/anamnese", "layout");
  }

  return NextResponse.json({
    ok: true,
    tipo,
    userId,
    contagens: resultado.contagens,
    mensagem: MENSAGENS[tipo](aluno.name),
  });
}
