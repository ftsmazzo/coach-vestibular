import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAnamneseStatus } from "@/lib/anamnese-motor";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const view = await getAnamneseStatus(session.userId);
  return NextResponse.json(view);
}
