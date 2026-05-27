import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeInviteCode, createSession, hashPassword, peekInviteCode } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  inviteCode: z.string().min(4),
  vestibularAlvo: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const invite = await peekInviteCode(body.inviteCode);
    if (!invite) {
      return NextResponse.json(
        { error: "Código de convite inválido, inativo ou esgotado" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        name: body.name.trim(),
        vestibularAlvo: body.vestibularAlvo?.trim() || "Medicina",
      },
    });

    await consumeInviteCode(body.inviteCode);

    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao registrar" }, { status: 500 });
  }
}
