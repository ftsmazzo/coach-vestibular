import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { iniciarJornadaUsuario } from "@/lib/jornada-elegibilidade";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Use o painel admin" }, { status: 403 });
  }

  const resultado = await iniciarJornadaUsuario(session.userId);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, motivosBloqueio: resultado.motivosBloqueio },
      { status: 400 }
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/plano");
  revalidatePath("/quests");

  return NextResponse.json({
    ok: true,
    jaIniciada: resultado.jaIniciada,
    mensagem: resultado.jaIniciada
      ? "Sua Jornada já estava iniciada."
      : "Jornada iniciada. O diagnóstico inicial completo será refinado na próxima etapa.",
  });
}
