import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { regenerarPlanoGlobalUsuario } from "@/lib/prova-attempt";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Use o painel admin" }, { status: 403 });
  }

  await regenerarPlanoGlobalUsuario(session.userId);
  return NextResponse.json({ ok: true });
}
