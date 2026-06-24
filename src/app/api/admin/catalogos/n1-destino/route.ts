import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { opcoesCatalogoN1 } from "@/lib/catalogos-n1-destino";

/** Lista catálogos destino N1 para o admin (dropdown de correção manual). */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return NextResponse.json({ opcoes: opcoesCatalogoN1() });
}
