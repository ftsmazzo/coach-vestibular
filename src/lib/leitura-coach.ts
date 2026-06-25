import { prisma } from "@/lib/prisma";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { buildDiagnosisForProva } from "@/lib/jornada-diagnostico";
import { abreviarNomeProva } from "@/lib/prova-label";
import type { JornadaDashboardAnalytics } from "@/lib/jornada-analytics";
import { materiasComDadosReais } from "@/lib/jornada-analytics";

export interface LeituraCoachProva {
  tituloProva: string;
  mensagem: string;
  focos: Array<{ label: string; prioridade: string }>;
  pctReferencia: number | null;
}

export async function getLeituraCoachProva(
  userId: string,
  provaId: string
): Promise<LeituraCoachProva | null> {
  const prova = await prisma.prova.findFirst({
    where: { id: provaId, publicada: true },
    select: { nome: true },
  });
  if (!prova) return null;

  const ultimoExam = await prisma.exam.findFirst({
    where: { userId, provaId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: true,
      diagnosticSnapshot: true,
    },
  });

  let mensagem = ultimoExam?.diagnosticSnapshot?.mensagem;
  let focos: Array<{ label: string; prioridade: string }> = [];

  if (ultimoExam?.diagnosticSnapshot?.focosJson) {
    try {
      const parsed = JSON.parse(ultimoExam.diagnosticSnapshot.focosJson) as
        | Array<{ escopoLabel?: string; prioridade?: string; label?: string }>
        | { pedagogicos?: Array<{ escopoLabel: string; prioridade: string }> };
      const list = Array.isArray(parsed) ? parsed : parsed.pedagogicos ?? [];
      focos = list.map((f) => ({
        label: ("escopoLabel" in f && f.escopoLabel) || ("label" in f && f.label) || "Escopo",
        prioridade: f.prioridade ?? "media",
      }));
    } catch {
      focos = [];
    }
  }

  if (!mensagem) {
    const diagnosis = await buildDiagnosisForProva(userId, provaId);
    if (!diagnosis) return null;
    mensagem = diagnosis.mensagem;
    focos = diagnosis.focosPedagogicos.map((f) => ({
      label: f.escopoLabel,
      prioridade: f.prioridade === "manutencao" ? "media" : f.prioridade,
    }));
  }

  return {
    tituloProva: abreviarNomeProva(prova.nome),
    mensagem,
    focos,
    pctReferencia: ultimoExam ? pctAcertoRegistro(ultimoExam.questionAttempts) : null,
  };
}

export function buildMensagemPanoramaJornada(
  analytics: JornadaDashboardAnalytics,
  evolucao: Array<{ taxaAcerto: number }>
): string {
  const pct = analytics.pctGlobalPonderado;
  const comDados = materiasComDadosReais(analytics.materiasMedia, 3);
  const ordenadas = [...comDados].sort((a, b) => a.pctAcerto - b.pctAcerto);

  const fracos = ordenadas.filter((m) => m.pctAcerto < 72).slice(0, 4).map((m) => m.label);
  const fortes = ordenadas
    .filter((m) => m.pctAcerto >= 78)
    .slice(-5)
    .reverse()
    .map((m) => m.label);

  const oscilam = ordenadas
    .filter((m) => m.pctAcerto >= 62 && m.pctAcerto < 78)
    .slice(0, 3)
    .map((m) => m.label);

  let tendencia = "";
  if (evolucao.length >= 2) {
    const ultima = evolucao[evolucao.length - 1]!.taxaAcerto;
    const anterior = evolucao[evolucao.length - 2]!.taxaAcerto;
    const delta = ultima - anterior;
    if (delta >= 5) {
      tendencia =
        " Sua última aplicação subiu em relação à anterior — sinal de progressão na jornada.";
    } else if (delta <= -5) {
      tendencia =
        " Na última aplicação o percentual caiu — use os focos abaixo para recuperar consistência.";
    } else {
      tendencia = " Entre as últimas aplicações você manteve um patamar estável.";
    }
  }

  const nivel =
    pct >= 75
      ? "bom e competitivo"
      : pct >= 60
        ? "em construção, com ganhos possíveis"
        : "com espaço claro para evoluir";

  const partes: string[] = [
    `Na sua jornada completa você está com ${pct}% de acertos ponderados (${analytics.totalRegistros} registro${analytics.totalRegistros !== 1 ? "s" : ""}), um panorama ${nivel}.`,
  ];

  if (fracos.length) {
    partes.push(
      ` As maiores oportunidades de ganho estão em ${formatLista(fracos)}.`
    );
  }
  if (oscilam.length && fracos.length < 4) {
    partes.push(` Vale atenção em ${formatLista(oscilam)} — desempenho intermediário ou oscilante.`);
  }
  if (fortes.length) {
    partes.push(
      ` Continue protegendo o que já funciona em ${formatLista(fortes)}.`
    );
  }
  if (tendencia) partes.push(tendencia);

  partes.push(
    " O plano da semana e as quests usam todos os seus registros — oficiais, simulados e listas."
  );

  return partes.join("").replace(/\s+/g, " ").trim();
}

function formatLista(itens: string[]): string {
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0]!;
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`;
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
