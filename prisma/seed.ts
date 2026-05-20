/**
 * Seed autossuficiente — não importa src/lib (seguro no Docker de produção).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import exemploSimulado from "../data/exemplo-simulado.json";

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL é obrigatória para o seed.");
  }
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const DEMO_DIAGNOSTIC = {
  recoveryMode: true,
  mensagem:
    "Este simulado foi pesado — e isso não define seu vestibular. Um passo de cada vez: esta semana foque em no máximo 3 temas (Estequiometria, Cinemática, Fisiologia Humana). Você já demonstrou capacidade em Matemática e Português. Respire, revise com calma.",
  scoresJson: {
    overallAcerto: 0.4,
    materiaScores: [
      { materiaId: "matematica", materiaLabel: "Matemática", total: 2, erros: 0, taxaAcerto: 1 },
      { materiaId: "portugues", materiaLabel: "Português", total: 1, erros: 0, taxaAcerto: 1 },
      { materiaId: "biologia", materiaLabel: "Biologia", total: 2, erros: 1, taxaAcerto: 0.5 },
      { materiaId: "fisica", materiaLabel: "Física", total: 2, erros: 2, taxaAcerto: 0 },
      { materiaId: "quimica", materiaLabel: "Química", total: 3, erros: 3, taxaAcerto: 0 },
    ],
  },
  focosJson: [
    {
      materiaId: "quimica",
      temaId: "estequiometria",
      label: "Química — Estequiometria",
      prioridade: "alta",
      motivo: "Errou este tema em 3 questões neste simulado",
    },
    {
      materiaId: "fisica",
      temaId: "cinematica",
      label: "Física — Cinemática",
      prioridade: "alta",
      motivo: "100% de erro neste simulado",
    },
    {
      materiaId: "biologia",
      temaId: "fisiologia_humana",
      label: "Biologia — Fisiologia Humana",
      prioridade: "media",
      motivo: "50% de erro neste simulado",
    },
  ],
};

const DEMO_PLAN_ITEMS = [
  {
    ordem: 1,
    titulo: "Química — Estequiometria",
    descricao: "Revisão leve: 10–15 questões de Estequiometria (base teórica). Sem pressa.",
    materiaId: "quimica",
    temaId: "estequiometria",
    duracaoMin: 25,
  },
  {
    ordem: 2,
    titulo: "Física — Cinemática",
    descricao: "Revisão leve: 10–15 questões de Cinemática (interpretação). Sem pressa.",
    materiaId: "fisica",
    temaId: "cinematica",
    duracaoMin: 25,
  },
];

const DEMO_QUESTS = [
  {
    titulo: "Química — Estequiometria",
    descricao: "Revisão leve: 10–15 questões de Estequiometria (base teórica). Sem pressa.",
    materiaId: "quimica",
    temaId: "estequiometria",
    duracaoMin: 25,
    rewardMsg: "Cada passo conta. Você está construindo consistência — isso vence na maratona do vestibular.",
  },
  {
    titulo: "Física — Cinemática",
    descricao: "Revisão leve: 10–15 questões de Cinemática (interpretação). Sem pressa.",
    materiaId: "fisica",
    temaId: "cinematica",
    duracaoMin: 25,
    rewardMsg: "Cada passo conta. Você está construindo consistência — isso vence na maratona do vestibular.",
  },
];

async function main() {
  if (process.env.RUN_SEED !== "true" && process.env.NODE_ENV === "production") {
    console.log("Seed ignorado (defina RUN_SEED=true para executar em produção).");
    return;
  }

  const prisma = createPrisma();

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.log("Banco já possui dados — seed ignorado (idempotente).");
      return;
    }

    await prisma.inviteCode.createMany({
      data: [
        { code: "MED2026-BETA", maxUses: 10 },
        { code: "COACH-FAMILIA", maxUses: 5 },
      ],
    });

    const passwordHash = await bcrypt.hash("demo1234", 10);

    const admin = await prisma.user.create({
      data: {
        email: "admin@coach.local",
        passwordHash,
        name: "Admin",
        role: "ADMIN",
      },
    });

    const student = await prisma.user.create({
      data: {
        email: "aluna@coach.local",
        passwordHash,
        name: "Estudante Demo",
        vestibularAlvo: "Medicina",
        metaProva: "ENEM 2026",
      },
    });

    const questoes = exemploSimulado.questoes.map((q) => ({
      numero: q.numero,
      correto: q.correto,
      materiaId: q.materiaId,
      temaId: q.temaId,
      tipoErro: (q.tipoErro as "base_teorica" | "interpretacao" | "atencao" | undefined) ?? null,
    }));

    const exam = await prisma.exam.create({
      data: {
        userId: student.id,
        nome: exemploSimulado.nome,
        data: new Date(exemploSimulado.data),
        banca: exemploSimulado.banca,
        totalQuestoes: exemploSimulado.totalQuestoes,
        nota: exemploSimulado.nota,
        checkInScore: exemploSimulado.checkInEmocional,
        recoveryMode: DEMO_DIAGNOSTIC.recoveryMode,
        questionAttempts: { create: questoes },
        diagnosticSnapshot: {
          create: {
            userId: student.id,
            scoresJson: JSON.stringify(DEMO_DIAGNOSTIC.scoresJson),
            focosJson: JSON.stringify(DEMO_DIAGNOSTIC.focosJson),
            mensagem: DEMO_DIAGNOSTIC.mensagem,
            recoveryMode: DEMO_DIAGNOSTIC.recoveryMode,
          },
        },
        emotionalLog: {
          create: { userId: student.id, score: exemploSimulado.checkInEmocional },
        },
      },
    });

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    await prisma.studyPlan.create({
      data: {
        userId: student.id,
        weekStart,
        itemsJson: JSON.stringify(DEMO_PLAN_ITEMS),
        recoveryMode: true,
      },
    });

    await prisma.quest.createMany({
      data: DEMO_QUESTS.map((q) => ({ ...q, userId: student.id })),
    });

    console.log("Seed OK");
    console.log("Admin:", admin.email, "senha: demo1234");
    console.log("Aluna:", student.email, "senha: demo1234");
    console.log("Convites: MED2026-BETA, COACH-FAMILIA");
    console.log("Exemplo simulado:", exam.id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
