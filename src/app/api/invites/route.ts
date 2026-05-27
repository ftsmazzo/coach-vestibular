import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const invites = await prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(invites);
}

const createSchema = z.object({
  code: z.string().min(4).optional(),
  maxUses: z.number().int().positive().default(5),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = createSchema.parse(await request.json());
    const code =
      body.code?.trim().toUpperCase() ??
      `COACH-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const existente = await prisma.inviteCode.findUnique({ where: { code } });
    if (existente) {
      return NextResponse.json({ error: "Já existe um convite com este código" }, { status: 400 });
    }

    const invite = await prisma.inviteCode.create({
      data: { code, maxUses: body.maxUses },
    });
    return NextResponse.json(invite);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });
  }
}
