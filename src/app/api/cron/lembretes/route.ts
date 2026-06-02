import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarNotificacao, telefoneParaWhatsapp } from "@/lib/notificacoes";

/**
 * Disparado 1x/dia por um Schedule do N8N. Protegido por CRON_SECRET.
 * Manda lembrete de quests do dia e de ciclo prestes a fechar (só quem tem WhatsApp).
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  const enviado =
    request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (enviado !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const agora = new Date();
  const hojeIni = new Date(agora);
  hojeIni.setHours(0, 0, 0, 0);
  const hojeFim = new Date(agora);
  hojeFim.setHours(23, 59, 59, 999);
  const em24h = new Date(agora.getTime() + 24 * 3600 * 1000);

  const [questsHoje, ciclosFechando] = await Promise.all([
    prisma.quest.findMany({
      where: { status: "pending", dueDate: { gte: hojeIni, lte: hojeFim } },
      select: { userId: true },
    }),
    prisma.learningCycle.findMany({
      where: { status: "ATIVO", endAt: { lte: em24h } },
      select: { userId: true, metaTitulo: true },
    }),
  ]);

  const questPorUser = new Map<string, number>();
  for (const q of questsHoje) {
    questPorUser.set(q.userId, (questPorUser.get(q.userId) ?? 0) + 1);
  }
  const cicloPorUser = new Map<string, string>();
  for (const c of ciclosFechando) {
    if (!cicloPorUser.has(c.userId)) cicloPorUser.set(c.userId, c.metaTitulo);
  }

  const userIds = [...new Set([...questPorUser.keys(), ...cicloPorUser.keys()])];
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, questLembretes: 0, cicloLembretes: 0 });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, role: "STUDENT", telefone: { not: null } },
    select: { id: true, name: true, telefone: true },
  });

  let questLembretes = 0;
  let cicloLembretes = 0;

  await Promise.allSettled(
    users.flatMap((u) => {
      const numero = telefoneParaWhatsapp(u.telefone);
      if (!numero) return [];
      const primeiroNome = u.name.split(/\s+/)[0] || "você";
      const tasks: Promise<void>[] = [];

      const n = questPorUser.get(u.id) ?? 0;
      if (n > 0) {
        questLembretes++;
        tasks.push(
          enviarNotificacao({
            evento: "quest_lembrete",
            numero,
            mensagem: `Oi, ${primeiroNome}! ⏰ Você tem ${n} tarefa${n > 1 ? "s" : ""} do ciclo pra hoje. Bora fazer uma agora? Abra o Coach em Quests. 💪`,
            meta: { quests: n },
          })
        );
      }

      const meta = cicloPorUser.get(u.id);
      if (meta) {
        cicloLembretes++;
        tasks.push(
          enviarNotificacao({
            evento: "ciclo_fechando",
            numero,
            mensagem: `Oi, ${primeiroNome}! 🏁 Seu ciclo (foco: ${meta}) está fechando. Faça o mini-quiz de fechamento pra ver sua evolução — leva poucos minutos.`,
            meta: { metaTitulo: meta },
          })
        );
      }
      return tasks;
    })
  );

  return NextResponse.json({ ok: true, questLembretes, cicloLembretes });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
