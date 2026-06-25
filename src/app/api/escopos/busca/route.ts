import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buscarEscoposPorTexto } from "@/lib/escopo-display";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const escopos = buscarEscoposPorTexto(q, 25);
  return NextResponse.json({ escopos });
}
