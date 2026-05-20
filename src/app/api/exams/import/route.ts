import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createExamWithDiagnosis } from "@/lib/exam-service";
import type { ErrorType } from "@/generated/prisma/client";

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1);

  return rows.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function resolveMateriaId(label: string) {
  if (!label) return undefined;
  const normalized = label.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const ids = ["biologia", "quimica", "fisica", "matematica", "portugues", "historia", "geografia"];
  return ids.find((id) => normalized.includes(id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const nome = (formData.get("nome") as string) || "Simulado importado";
  const data = (formData.get("data") as string) || new Date().toISOString().slice(0, 10);

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

  const text = await file.text();
  const rows = parseCsv(text);
  const questoes = rows.map((row, i) => {
    const acertou = row.acertou?.toLowerCase() === "true";
    const materiaLabel = row.materia_sugerida || row.materia || "";
    const temaId = (row.tema_sugerido || row.tema || "").toLowerCase().replace(/\s+/g, "_");
    const materiaId = resolveMateriaId(materiaLabel) ?? row.materia_id;
    const tipoErro = row.tipo_erro as ErrorType | undefined;

    return {
      numero: parseInt(row.numero_questao || String(i + 1), 10),
      correto: acertou,
      materiaId: materiaId || undefined,
      temaId: temaId || undefined,
      tipoErro: ["base_teorica", "interpretacao", "atencao", "tempo"].includes(tipoErro ?? "")
        ? tipoErro
        : undefined,
      observacao: row.observacao,
    };
  });

  const result = await createExamWithDiagnosis({
    userId: session.userId,
    nome,
    data,
    totalQuestoes: questoes.length,
    questoes,
  });

  return NextResponse.json(result);
}
