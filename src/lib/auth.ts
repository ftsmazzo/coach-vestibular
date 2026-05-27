import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "coach-vestibular-dev-secret-change-in-production"
);

const COOKIE_NAME = "coach_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: "STUDENT" | "ADMIN";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

/** Verifica convite sem consumir uso (para validar antes de criar conta). */
export async function peekInviteCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 4) return null;
  const invite = await prisma.inviteCode.findUnique({ where: { code: normalized } });
  if (!invite || !invite.active || invite.usedCount >= invite.maxUses) {
    return null;
  }
  return invite;
}

/** Incrementa uso — chamar só após conta criada com sucesso. */
export async function consumeInviteCode(code: string) {
  const invite = await peekInviteCode(code);
  if (!invite) return false;
  await prisma.inviteCode.update({
    where: { id: invite.id },
    data: { usedCount: { increment: 1 } },
  });
  return true;
}

/** @deprecated Use peekInviteCode + consumeInviteCode */
export async function validateInviteCode(code: string) {
  const ok = await peekInviteCode(code);
  if (!ok) return false;
  return consumeInviteCode(code);
}
