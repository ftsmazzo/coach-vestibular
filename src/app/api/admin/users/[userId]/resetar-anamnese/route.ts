import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { resetarSomenteAnamneseAdmin } from "@/lib/jornada-reset-admin";
import { prisma } from "@/lib/prisma";

/**
 * Apaga SOMENTE a anamnese do aluno (mantém plano, quests, provas, tudo).
 * O banner "Entendendo sua jornada" volta na Home; ao concluir de novo,
 * o plano é regenerado a partir da nova anamnese (em finalizarAnamnese).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId } = await params;
  const aluno = await prisma.user.findFirst({
    where: { id: userId, role: "STUDENT" },
    select: { id: true, name: true },
  });
  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  }

  const r = await resetarSomenteAnamneseAdmin(userId);

  revalidatePath("/dashboard", "layout");
  revalidatePath("/anamnese", "layout");

  return NextResponse.json({
    ok: true,
    removida: r.studentAnamnesis > 0,
    mensagem:
      r.studentAnamnesis > 0
        ? `Anamnese de ${aluno.name} apagada. O banner volta na Home; quando ${aluno.name.split(" ")[0]} refizer a conversa, o plano é regenerado a partir dela. (Plano e provas atuais foram mantidos.)`
        : `${aluno.name} ainda não tinha anamnese registrada.`,
  });
}
