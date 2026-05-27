import type { AttemptInput } from "@/lib/diagnosis";
import type { StudyPlanItem } from "@/lib/study-plan";
import { buildResumoJornada } from "@/lib/jornada";
import { examsRecentesJornada } from "@/lib/jornada-historico";
import { mapMateriaAssuntoToTaxonomy } from "@/lib/taxonomia-validacao";

/** Histórico de attempts de vários registros (jornada) para recorrência de temas. */
export async function historicalAttemptsDaJornada(
  userId: string,
  excludeExamId?: string
): Promise<AttemptInput[][]> {
  const exams = await examsRecentesJornada(userId, 8, excludeExamId);
  return exams.map((e) =>
    e.questionAttempts.map((a) => {
      const mat = a.materiaCorrigida || a.provaQuestao?.materia;
      const ass = a.assuntoCorrigido || a.provaQuestao?.assunto;
      const mapped = mat && ass ? mapMateriaAssuntoToTaxonomy(mat, ass) : undefined;
      return {
        numero: a.numero,
        correto: a.correto,
        materiaId: a.materiaId ?? mapped?.materiaId,
        temaId: a.temaId ?? mapped?.temaId,
        tipoErro: a.tipoErro,
        observacao: a.observacao,
      };
    })
  );
}

/** Mescla histórico da mesma prova + jornada global (sem duplicar exam). */
export function mergeHistoricalAttempts(
  mesmaProva: AttemptInput[][],
  jornada: AttemptInput[][],
  maxTotal = 10
): AttemptInput[][] {
  const seen = new Set<string>();
  const out: AttemptInput[][] = [];
  for (const batch of [...mesmaProva, ...jornada]) {
    const key = batch.map((a) => `${a.numero}:${a.correto}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(batch);
    if (out.length >= maxTotal) break;
  }
  return out;
}

/** Bloco inicial do plano com visão da jornada agregada. */
export async function itensContextoJornadaNoPlano(userId: string): Promise<StudyPlanItem[]> {
  const j = await buildResumoJornada(userId);
  if (j.totalRegistros < 2) return [];

  const topMaterias = j.porMateria
    .slice(0, 4)
    .map((m) => `${m.label} (${m.erros} erro${m.erros !== 1 ? "s" : ""} ponderados)`)
    .join("; ");

  const modos = j.porModoUso
    .map((m) => `${m.registros}× ${m.label.split("(")[0].trim()} (${m.pctAcerto}%)`)
    .join(" · ");

  const items: StudyPlanItem[] = [
    {
      ordem: 0,
      titulo: "Panorama da sua jornada",
      descricao:
        `Este plano considera o último registro **e** seus ${j.totalRegistros} registros no total ` +
        `(acerto ponderado ${j.pctAcertoPonderado}% — oficiais pesam mais que treinos e revisões). ` +
        (modos ? `Por tipo: ${modos}. ` : "") +
        (topMaterias
          ? `Maior pressão acumulada de erro: ${topMaterias}. `
          : "") +
        `Priorize o que se repete em provas oficiais; use simulados como termômetro.`,
      duracaoMin: 0,
      bloco: "contexto",
      geraQuest: false,
    },
  ];

  return items;
}

/** Insere contexto da jornada e renumera ordens. */
export async function mesclarPlanoComJornada(
  items: StudyPlanItem[],
  userId: string
): Promise<StudyPlanItem[]> {
  const contexto = await itensContextoJornadaNoPlano(userId);
  if (contexto.length === 0) return items;

  const merged = [...contexto, ...items];
  return merged.map((item, i) => ({ ...item, ordem: i + 1 }));
}
