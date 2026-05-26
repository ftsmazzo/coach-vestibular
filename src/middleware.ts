import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "coach-vestibular-dev-secret-change-in-production"
);

const publicPaths = ["/login", "/register", "/api/auth/login", "/api/auth/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("coach_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Uploads grandes (PDF/texto da prova, CSV): fora do middleware para não
     * bufferizar o body (limite 10MB). Auth nessas rotas via requireAdmin().
     */
    "/((?!_next/static|_next/image|favicon.ico|api/admin/provas/[^/]+/extrair|api/admin/provas/[^/]+/questoes|api/admin/provas/[^/]+/texto-fonte|api/admin/provas/[^/]+/pipeline).*)",
  ],
};
