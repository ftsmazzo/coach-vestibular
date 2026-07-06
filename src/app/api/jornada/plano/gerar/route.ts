import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { gerarOuObterPlanoSemanalJornada } from "@/lib/jornada-plano-semanal";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Use o painel admin" }, { status: 403 });
  }

  const resultado = await gerarOuObterPlanoSemanalJornada(session.userId);

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.error }, { status: 400 });
  }

  revalidatePath("/dashboard");
  revalidatePath("/plano");
  revalidatePath("/quests");

  return NextResponse.json(resultado);
}
