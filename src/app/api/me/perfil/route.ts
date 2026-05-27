import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { parseNomeExibicaoRanking } from "@/lib/apelido-ranking";
import { normalizarTelefone } from "@/lib/telefone";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(80).optional(),
  email: z.string().email("E-mail inválido").optional(),
  telefone: z.string().max(30).optional(),
  nomeExibicaoRanking: z.string().max(24).optional(),
  vestibularAlvo: z.string().min(1).max(120).optional(),
  metaProva: z.string().max(200).optional(),
  senhaAtual: z.string().optional(),
  senhaNova: z.string().min(6, "Nova senha: mínimo 6 caracteres").optional(),
});

const userSelect = {
  name: true,
  email: true,
  telefone: true,
  nomeExibicaoRanking: true,
  vestibularAlvo: true,
  metaProva: true,
  xp: true,
} as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: userSelect,
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

    if (body.senhaNova && !body.senhaAtual) {
      return NextResponse.json(
        { error: "Informe a senha atual para definir uma nova senha" },
        { status: 400 }
      );
    }

    let nomeRanking: string | null | undefined;
    if (body.nomeExibicaoRanking !== undefined) {
      const parsed = parseNomeExibicaoRanking(body.nomeExibicaoRanking);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      nomeRanking = parsed.value;
    }

    if (body.email) {
      const dup = await prisma.user.findFirst({
        where: { email: body.email.trim().toLowerCase(), id: { not: session.userId } },
      });
      if (dup) {
        return NextResponse.json({ error: "Este e-mail já está em uso" }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    if (body.telefone !== undefined) {
      const tel = normalizarTelefone(body.telefone);
      if (body.telefone.trim() && !tel) {
        return NextResponse.json(
          { error: "Telefone inválido — use DDD + número (mín. 10 dígitos)" },
          { status: 400 }
        );
      }
      data.telefone = tel;
    }
    if (nomeRanking !== undefined) data.nomeExibicaoRanking = nomeRanking;
    if (body.vestibularAlvo !== undefined) data.vestibularAlvo = body.vestibularAlvo.trim();
    if (body.metaProva !== undefined) data.metaProva = body.metaProva.trim() || null;

    if (body.senhaNova && body.senhaAtual) {
      const atual = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { passwordHash: true },
      });
      if (!atual || !(await verifyPassword(body.senhaAtual, atual.passwordHash))) {
        return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.senhaNova);
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: userSelect,
    });

    await createSession({
      userId: session.userId,
      email: user.email,
      name: user.name,
      role: session.role,
    });

    return NextResponse.json({ ok: true, user, mensagem: "Perfil atualizado." });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao salvar perfil" }, { status: 500 });
  }
}
