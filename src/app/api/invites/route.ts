import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const invites = await prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(invites);
}

const createSchema = z.object({
  code: z.string().min(4).optional(),
  maxUses: z.number().int().positive().default(5),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = createSchema.parse(await request.json());
  const code =
    body.code?.toUpperCase() ??
    `MED${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const invite = await prisma.inviteCode.create({
    data: { code, maxUses: body.maxUses },
  });
  return NextResponse.json(invite);
}
