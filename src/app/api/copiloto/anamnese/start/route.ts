import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { startAnamnese } from "@/lib/anamnese-motor";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const view = await startAnamnese(session.userId);
  return NextResponse.json(view);
}
