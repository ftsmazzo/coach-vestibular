import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  vestibularAlvo: z.string().min(1).max(120).optional(),
  metaProva: z.string().max(200).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      vestibularAlvo: true,
      metaProva: true,
      xp: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Use a área admin para admins" }, { status: 400 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(body.vestibularAlvo !== undefined
          ? { vestibularAlvo: body.vestibularAlvo.trim() }
          : {}),
        ...(body.metaProva !== undefined
          ? { metaProva: body.metaProva.trim() || null }
          : {}),
      },
      select: {
        vestibularAlvo: true,
        metaProva: true,
        xp: true,
      },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao salvar perfil" }, { status: 500 });
  }
}
