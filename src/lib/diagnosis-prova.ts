import type { DiagnosisResult } from "./diagnosis";

export interface QuestaoPedagogica {
  numero: number;
  correto: boolean;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
}

export interface MateriaErroResumo {
  materia: string;
  erros: number;
  acertos: number;
  total: number;
  numerosErrados: number[];
}

export interface AssuntoPrioritario {
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  erros: number;
  numerosErrados: number[];
}

export interface ResumoProvaDiagnostico {
  total: number;
  acertos: number;
  erros: number;
  pctAcerto: number;
  pctErro: number;
  materiasComMaisErros: MateriaErroResumo[];
  /** Todas as matérias da prova, da que mais falhou à mais estável */
  todasMaterias: MateriaErroResumo[];
  assuntosPrioritarios: AssuntoPrioritario[];
}

function formatNumeros(nums: number[], max = 12): string {
  if (nums.length === 0) return "";
  const slice = nums.slice(0, max);
  const tail = nums.length > max ? ` (+${nums.length - max})` : "";
  return `nº ${slice.join(", ")}${tail}`;
}

export function buildResumoProva(questoes: QuestaoPedagogica[]): ResumoProvaDiagnostico {
  const total = questoes.length;
  const acertos = questoes.filter((q) => q.correto).length;
  const erros = total - acertos;

  const porMateria = new Map<string, MateriaErroResumo>();
  const porAssunto = new Map<string, AssuntoPrioritario>();

  for (const q of questoes) {
    const mat = q.materia.trim() || "A classificar";
    const m =
      porMateria.get(mat) ??
      ({ materia: mat, erros: 0, acertos: 0, total: 0, numerosErrados: [] } satisfies MateriaErroResumo);
    m.total++;
    if (q.correto) m.acertos++;
    else {
      m.erros++;
      m.numerosErrados.push(q.numero);
    }
    porMateria.set(mat, m);

    const keyAssunto = `${mat}::${q.assunto.trim() || "Geral"}`;
    const a =
      porAssunto.get(keyAssunto) ??
      ({
        materia: mat,
        assunto: q.assunto.trim() || "Geral",
        conhecimentoExigido: q.conhecimentoExigido,
        nivelDificuldade: q.nivelDificuldade,
        erros: 0,
        numerosErrados: [],
      } satisfies AssuntoPrioritario);
    if (!q.correto) {
      a.erros++;
      a.numerosErrados.push(q.numero);
      if (q.conhecimentoExigido && !a.conhecimentoExigido) {
        a.conhecimentoExigido = q.conhecimentoExigido;
      }
      if (q.nivelDificuldade && !a.nivelDificuldade) {
        a.nivelDificuldade = q.nivelDificuldade;
      }
    }
    porAssunto.set(keyAssunto, a);
  }

  const materiasComMaisErros = [...porMateria.values()]
    .filter((m) => m.erros > 0)
    .sort((a, b) => b.erros - a.erros)
    .slice(0, 2);

  const assuntosPrioritarios = [...porAssunto.values()]
    .filter((a) => a.erros > 0)
    .sort((a, b) => b.erros - a.erros)
    .slice(0, 8);

  const todasMaterias = [...porMateria.values()].sort((a, b) => {
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
    materiasComMaisErros,
    todasMaterias,
    assuntosPrioritarios,
  };
}

function buildMensagemConcreta(
  diagnosis: DiagnosisResult,
  resumo: ResumoProvaDiagnostico,
  checkIn?: number | null
): string {
  const { acertos, erros, total, pctAcerto, pctErro } = resumo;
  const partes: string[] = [
    `Nesta prova você acertou ${acertos} de ${total} questões (${pctAcerto}% de acerto, ${pctErro}% de erro).`,
  ];

  if (resumo.materiasComMaisErros.length > 0) {
    const matTexto = resumo.materiasComMaisErros
      .map(
        (m) =>
          `${m.materia} (${m.erros} erro${m.erros > 1 ? "s" : ""} — ${formatNumeros(m.numerosErrados)})`
      )
      .join("; ");
    partes.push(`Matérias com mais erros: ${matTexto}.`);
  }

  if (resumo.assuntosPrioritarios.length > 0) {
    const assuntoTexto = resumo.assuntosPrioritarios
      .slice(0, 2)
      .map((a) => `${a.materia} — ${a.assunto}`)
      .join("; ");
    partes.push(`Assuntos para priorizar na semana: ${assuntoTexto}.`);
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

  const focos = resumoProva.assuntosPrioritarios.map((a, i) => {
    const prev = diagnosis.focos[i];
    const nums = formatNumeros(a.numerosErrados, 8);
    const conhec =
      a.conhecimentoExigido && a.conhecimentoExigido.length > 0
        ? ` · ${a.conhecimentoExigido}`
        : "";
    const dif = a.nivelDificuldade ? ` (${a.nivelDificuldade})` : "";
    return {
      materiaId: prev?.materiaId ?? "geral",
      temaId: prev?.temaId ?? "geral",
      label: `${a.materia} — ${a.assunto}`,
      prioridade: (a.erros >= 2 ? "alta" : "media") as "alta" | "media",
      motivo: `${a.erros} erro(s) — ${nums}${conhec}${dif}`,
      tipoErroDominante: prev?.tipoErroDominante,
      assunto: a.assunto,
      conhecimentoExigido: a.conhecimentoExigido,
      nivelDificuldade: a.nivelDificuldade,
      numerosErrados: a.numerosErrados,
    };
  });

  return {
    ...diagnosis,
    resumoProva,
    focos: focos.length > 0 ? focos : diagnosis.focos,
    mensagem: buildMensagemConcreta(diagnosis, resumoProva, checkIn),
  };
}
