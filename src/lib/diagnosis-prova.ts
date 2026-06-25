import type { DiagnosisResult } from "./diagnosis";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";

export interface QuestaoPedagogica {
  numero: number;
  correto: boolean;
  materia: string;
  assunto: string;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
}

export interface EscopoErroResumo {
  escopoId: string;
  escopoLabel: string;
  materia: string;
  erros: number;
  acertos: number;
  total: number;
  numerosErrados: number[];
}

export interface ResumoProvaDiagnostico {
  total: number;
  acertos: number;
  erros: number;
  pctAcerto: number;
  pctErro: number;
  /** Top escopos N2 com mais erros */
  escoposPrioritarios: EscopoErroResumo[];
  /** Todos os escopos da prova, da maior fragilidade para a mais estável */
  todosEscopos: EscopoErroResumo[];
}

function formatNumeros(nums: number[], max = 12): string {
  if (nums.length === 0) return "";
  const slice = nums.slice(0, max);
  const tail = nums.length > max ? ` (+${nums.length - max})` : "";
  return `nº ${slice.join(", ")}${tail}`;
}

function labelEscopo(q: QuestaoPedagogica): { escopoId: string; escopoLabel: string } {
  const escopoId = q.conhecimentoEscopoId?.trim() || `${q.materia}::${q.assunto}`;
  const idx = indexGlobalEscopos();
  const meta = idx.get(escopoId);
  const escopoLabel =
    meta?.escopoLabel ??
    (q.conhecimentoExigido?.trim() || `${q.materia} — ${q.assunto}`);
  return { escopoId, escopoLabel };
}

export function buildResumoProva(questoes: QuestaoPedagogica[]): ResumoProvaDiagnostico {
  const total = questoes.length;
  const acertos = questoes.filter((q) => q.correto).length;
  const erros = total - acertos;

  const porEscopo = new Map<string, EscopoErroResumo>();

  for (const q of questoes) {
    const { escopoId, escopoLabel } = labelEscopo(q);
    const mat = q.materia.trim() || "A classificar";
    const e =
      porEscopo.get(escopoId) ??
      ({
        escopoId,
        escopoLabel,
        materia: mat,
        erros: 0,
        acertos: 0,
        total: 0,
        numerosErrados: [],
      } satisfies EscopoErroResumo);
    e.total++;
    if (q.correto) e.acertos++;
    else {
      e.erros++;
      e.numerosErrados.push(q.numero);
    }
    porEscopo.set(escopoId, e);
  }

  const escoposPrioritarios = [...porEscopo.values()]
    .filter((e) => e.erros > 0)
    .sort((a, b) => b.erros - a.erros)
    .slice(0, 8);

  const todosEscopos = [...porEscopo.values()].sort((a, b) => {
    if (b.erros !== a.erros) return b.erros - a.erros;
    const taxaA = a.total > 0 ? a.erros / a.total : 0;
    const taxaB = b.total > 0 ? b.erros / b.total : 0;
    return taxaB - taxaA;
  });

  return {
    total,
    acertos,
    erros,
    pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
    pctErro: total > 0 ? Math.round((erros / total) * 100) : 0,
    escoposPrioritarios,
    todosEscopos,
  };
}

function buildMensagemConcreta(
  diagnosis: DiagnosisResult,
  resumo: ResumoProvaDiagnostico,
  checkIn?: number | null
): string {
  const { acertos, total, pctAcerto, pctErro } = resumo;
  const partes: string[] = [
    `Nesta prova você acertou ${acertos} de ${total} questões (${pctAcerto}% de acerto, ${pctErro}% de erro).`,
  ];

  if (resumo.escoposPrioritarios.length > 0) {
    const escTexto = resumo.escoposPrioritarios
      .slice(0, 3)
      .map(
        (e) =>
          `${e.escopoLabel} (${e.erros} erro${e.erros > 1 ? "s" : ""} — ${formatNumeros(e.numerosErrados)})`
      )
      .join("; ");
    partes.push(`Escopos com mais erros: ${escTexto}.`);
  }

  const focoPrincipal = diagnosis.focosPedagogicos[0];
  if (focoPrincipal) {
    partes.push(
      `Foco da semana: ${focoPrincipal.escopoLabel} — ${focoPrincipal.objetivoDaSemana}.`
    );
  }

  if (diagnosis.recoveryMode) {
    partes.push(
      checkIn != null && checkIn <= 2
        ? "Você marcou que a prova foi pesada (check-in baixo) — o plano desta semana ficou mais leve."
        : "Plano em modo recuperação (desempenho ou check-in) — metas menores, sem culpa."
    );
  } else if (diagnosis.fortes.length > 0) {
    partes.push(`Pontos fortes nesta prova: ${diagnosis.fortes.join(", ")}.`);
  }

  return partes.join(" ");
}

export function enriquecerDiagnosticoComProva(
  diagnosis: DiagnosisResult,
  questoes: QuestaoPedagogica[],
  checkIn?: number | null
): DiagnosisResult {
  const resumoProva = buildResumoProva(questoes);

  return {
    ...diagnosis,
    resumoProva,
    mensagem: buildMensagemConcreta(diagnosis, resumoProva, checkIn),
  };
}
