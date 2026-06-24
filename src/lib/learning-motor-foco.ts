import { prisma } from "@/lib/prisma";
import type { FocoPedagogico } from "@/lib/diagnosis-escopo";
import { buildDiagnosisFromJornada } from "@/lib/jornada-diagnostico";
import type { BaselineCiclo } from "@/lib/learning-storytelling";

/** Lê focos pedagógicos do último DiagnosticSnapshot ou recalcula pela jornada. */
export async function getFocosPedagogicosRecentes(
  userId: string,
  limit = 3
): Promise<FocoPedagogico[]> {
  const snap = await prisma.diagnosticSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (snap?.scoresJson) {
    try {
      const scores = JSON.parse(snap.scoresJson) as {
        focosPedagogicos?: FocoPedagogico[];
      };
      if (scores.focosPedagogicos?.length) {
        return scores.focosPedagogicos.slice(0, limit);
      }
    } catch {
      /* ignora */
    }
  }

  if (snap?.focosJson) {
    try {
      const focos = JSON.parse(snap.focosJson) as {
        pedagogicos?: FocoPedagogico[];
      };
      if (focos.pedagogicos?.length) {
        return focos.pedagogicos.slice(0, limit);
      }
    } catch {
      /* ignora */
    }
  }

  const diagnosis = await buildDiagnosisFromJornada(userId);
  return diagnosis.focosPedagogicos?.slice(0, limit) ?? [];
}

export async function getFocoPedagogicoPrincipal(
  userId: string
): Promise<FocoPedagogico | null> {
  const [foco] = await getFocosPedagogicosRecentes(userId, 1);
  return foco ?? null;
}

export function baselineCicloFromFoco(foco: FocoPedagogico): BaselineCiclo {
  return {
    focos: [
      {
        escopoId: foco.escopoId,
        escopoLabel: foco.escopoLabel,
        errosRecentes: foco.totalErros,
        questoesOrigem: foco.numerosErrados,
        taxaAcerto: foco.taxaAcerto,
        tipoErroDominante: foco.tipoErroDominante ?? null,
        metadadosCognitivosResumo:
          foco.metadadosCognitivosResumo?.resumoTexto ?? null,
        objetivo: foco.objetivoDaSemana,
      },
    ],
    capturadoEm: new Date().toISOString(),
  };
}
