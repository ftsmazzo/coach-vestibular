import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  if (raw.startsWith("file:")) {
    const filePath = raw.replace(/^file:/, "");
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), path.basename(filePath));
    return `file:${resolved}`;
  }
  return raw;
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: getDatabaseUrl() });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient };
