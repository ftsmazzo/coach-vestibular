import type { ErrorType } from "@/generated/prisma/client";
import { formatDataAplicacao } from "@/lib/data-prova";
import { prisma } from "@/lib/prisma";
import { getTipoErroLabel, taxonomy } from "@/lib/taxonomy";

export interface CausaErroJornada {
  id: ErrorType;
  label: string;
  count: number;
  pct: number;
  cor: string;
}

export interface CheckInJornada {
  score: number;
  dataLabel: string;
}

export interface MetacognicaoJornada {
  totalErros: number;
  errosClassificados: number;
  pctErrosClassificados: number;
  mediaCheckIn: number | null;
  totalCheckIns: number;
  checkIns: CheckInJornada[];
  causas: CausaErroJornada[];
  causaDominante: CausaErroJornada | null;
  insight: string;
}

const CORES_CAUSA: Record<ErrorType, string> = {
  CONCEITO_TEORICO: "#7c3aed",
  CALCULO_BOBEIRA: "#d97706",
  INTERPRETACAO_ENUNCIADO: "#2563eb",
  DUVIDA_CRUCIAL: "#e11d48",
  CHUTE_TOTAL: "#64748b",
  FALTA_TEMPO: "#ea580c",
};

function insightMetacognicao(
  causa: CausaErroJornada | null,
  pctClassificados: number,
  mediaCheckIn: number | null
): string {
  if (mediaCheckIn != null && mediaCheckIn <= 2.2) {
    return "Check-ins emocionais baixos — vale ritmo mais leve nas próximas semanas e revisão sem culpa.";
  }
  if (pctClassificados < 40) {
    return "Classifique mais erros após cada prova: isso destrava um plano mais preciso e personalizado.";
  }
  if (!causa) {
    return "Registre provas e marque como se sentiu após cada uma para acompanhar corpo e mente na preparação.";
  }
  switch (causa.id) {
    case "CONCEITO_TEORICO":
      return `Padrão dominante: ${causa.label} (${causa.pct}% dos erros classificados) — priorize revisão de conteúdo antes de mais simulados.`;
    case "INTERPRETACAO_ENUNCIADO":
      return "Muitos erros por leitura do enunciado — treine interpretação e sublinhado ativo nas próximas listas.";
    case "CALCULO_BOBEIRA":
      return "Atenção e conta aparecem como causa frequente — listas cronometradas com conferência dupla ajudam.";
    case "FALTA_TEMPO":
      return "Gestão de tempo pesa na jornada — simule o ritmo real da prova nos próximos treinos.";
    case "CHUTE_TOTAL":
      return "Chutes indicam lacuna ou pressa — reduza incerteza com estudo dirigido nos assuntos que mais caem.";
    default:
      return `${causa.label} lidera suas causas de erro — use isso para escolher o tipo de quest no plano.`;
  }
}

export async function buildMetacognicaoGlobalJornada(
  userId: string
): Promise<MetacognicaoJornada | null> {
  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    select: {
      data: true,
      checkInScore: true,
      questionAttempts: {
        select: { correto: true, tipoErro: true },
      },
    },
  });

  if (exams.length === 0) return null;

  const counts = new Map<ErrorType, number>();
  let totalErros = 0;
  let errosClassificados = 0;

  for (const exam of exams) {
    for (const q of exam.questionAttempts) {
      if (q.correto) continue;
      totalErros++;
      if (q.tipoErro) {
        errosClassificados++;
        counts.set(q.tipoErro, (counts.get(q.tipoErro) ?? 0) + 1);
      }
    }
  }

  const checkInsRaw = exams
    .filter((e) => e.checkInScore != null)
    .slice(0, 10)
    .reverse()
    .map((e) => ({
      score: e.checkInScore!,
      dataLabel: formatDataAplicacao(e.data),
    }));

  const scores = exams.map((e) => e.checkInScore).filter((s): s is number => s != null);
  const mediaCheckIn =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  const causas: CausaErroJornada[] = taxonomy.tiposErro
    .map((t) => {
      const count = counts.get(t.id as ErrorType) ?? 0;
      return {
        id: t.id as ErrorType,
        label: getTipoErroLabel(t.id) ?? t.label,
        count,
        pct: errosClassificados > 0 ? Math.round((count / errosClassificados) * 100) : 0,
        cor: CORES_CAUSA[t.id as ErrorType],
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const causaDominante = causas[0] ?? null;
  const pctErrosClassificados =
    totalErros > 0 ? Math.round((errosClassificados / totalErros) * 100) : 0;

  if (totalErros === 0 && checkInsRaw.length === 0) return null;

  return {
    totalErros,
    errosClassificados,
    pctErrosClassificados,
    mediaCheckIn,
    totalCheckIns: scores.length,
    checkIns: checkInsRaw,
    causas,
    causaDominante,
    insight: insightMetacognicao(causaDominante, pctErrosClassificados, mediaCheckIn),
  };
}
