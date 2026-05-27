import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gerarSenhaTemporaria } from "@/lib/senha-temporaria";

const createSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6).optional(),
  vestibularAlvo: z.string().optional(),
  metaProva: z.string().optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      vestibularAlvo: true,
      metaProva: true,
      createdAt: true,
      _count: { select: { exams: true } },
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      vestibularAlvo: u.vestibularAlvo,
      metaProva: u.metaProva,
      createdAt: u.createdAt.toISOString(),
      registrosProva: u._count.exams,
    }))
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = createSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado" }, { status: 400 });
    }

    const senhaInicial = body.password?.trim() || gerarSenhaTemporaria();
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash: await hashPassword(senhaInicial),
        role: "STUDENT",
        vestibularAlvo: body.vestibularAlvo?.trim() || "Medicina",
        metaProva: body.metaProva?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        vestibularAlvo: true,
        metaProva: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
      senhaInicial: body.password ? undefined : senhaInicial,
      mensagem: body.password
        ? "Conta criada. O aluno pode entrar com o e-mail e a senha definida."
        : "Conta criada. Copie a senha inicial abaixo — ela não será exibida de novo.",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
