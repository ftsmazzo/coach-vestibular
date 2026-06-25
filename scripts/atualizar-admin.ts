/**
 * Atualiza só a conta admin — não altera alunos.
 * Uso: npx tsx scripts/atualizar-admin.ts
 *
 * Opcional: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_EMAIL_ANTIGO
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "fredmazzo@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Fs142779@1524";
const EMAILS_ANTIGOS = (
  process.env.ADMIN_EMAIL_ANTIGO ?? "admin@coach.local"
)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL é obrigatória.");
  }
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function main() {
  const prisma = createPrisma();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  try {
    const alunos = await prisma.user.count({ where: { role: "STUDENT" } });
    console.log(`Alunos no banco (inalterados): ${alunos}`);

    const jaExiste = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

    if (jaExiste) {
      if (jaExiste.role !== "ADMIN") {
        throw new Error(`${ADMIN_EMAIL} já existe como ${jaExiste.role}, não como ADMIN.`);
      }
      await prisma.user.update({
        where: { id: jaExiste.id },
        data: { passwordHash, name: jaExiste.name || "Admin", role: "ADMIN" },
      });
      console.log(`Admin atualizado: ${ADMIN_EMAIL}`);
      return;
    }

    let adminAntigo = null;
    for (const email of EMAILS_ANTIGOS) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u?.role === "ADMIN") {
        adminAntigo = u;
        break;
      }
    }

    if (!adminAntigo) {
      adminAntigo = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    }

    if (adminAntigo) {
      await prisma.user.update({
        where: { id: adminAntigo.id },
        data: {
          email: ADMIN_EMAIL,
          passwordHash,
          name: adminAntigo.name || "Admin",
          role: "ADMIN",
        },
      });
      console.log(`Admin migrado: ${adminAntigo.email} → ${ADMIN_EMAIL}`);
      return;
    }

    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        name: "Admin",
        role: "ADMIN",
      },
    });
    console.log(`Admin criado: ${ADMIN_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
