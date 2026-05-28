import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { finalizarAnamnese } from "@/lib/anamnese-motor";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const view = await finalizarAnamnese(session.userId);
  return NextResponse.json(view);
}
