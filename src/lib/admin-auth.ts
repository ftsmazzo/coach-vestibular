import { getSession } from "./auth";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { session };
}
