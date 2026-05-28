import type { DiagnosisResult } from "./diagnosis";
import type { AssuntoPrioritario, MateriaErroResumo } from "./diagnosis-prova";
import { getTipoErroLabel } from "./taxonomy";

export type BlocoPlano =
  | "diagnostico"
  | "analise_materia"
  | "contexto"
  | "prioridade_materia"
  | "foco_profundo"
  | "consolidacao"
  | "manutencao"
  | "integracao"
  | "meta";

export interface StudyPlanItem {
  ordem: number;
  titulo: string;
  descricao: string;
  materiaId?: string;
  temaId?: string;
  tipoErro?: string;
  duracaoMin: number;
  numerosQuestoes?: number[];
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  bloco?: BlocoPlano;
  materiaDestaque?: string;
  errosNaMateria?: number;
  /** Texto de erros nas quests: prova isolada vs jornada agregada */
  errosContexto?: "prova" | "jornada";
  geraQuest?: boolean;
}

function taxaErro(mat: MateriaErroResumo): number {
  return mat.total > 0 ? mat.erros / mat.total : 0;
}

function classificarMaterias(resumo: NonNullable<DiagnosisResult["resumoProva"]>) {
  const idsCriticas = new Set(resumo.materiasComMaisErros.map((m) => m.materia));
  const criticas = resumo.materiasComMaisErros;
  const atencao: MateriaErroResumo[] = [];
  const solidas: MateriaErroResumo[] = [];

  for (const m of resumo.todasMaterias) {
    if (idsCriticas.has(m.materia)) continue;
    if (m.erros === 0 && m.total >= 2) solidas.push(m);
    else if (m.erros > 0 || taxaErro(m) >= 0.25) atencao.push(m);
    else if (m.total > 0) solidas.push(m);
  }

  return { criticas, atencao, solidas };
}

function formatNums(nums: number[], max = 10): string {
  if (nums.length === 0) return "";
  const s = nums.slice(0, max).join(", ");
  return nums.length > max ? `${s}…` : s;
}

function etapasProfundas(assunto: AssuntoPrioritario, recoveryMode: boolean): string {
  const nums = formatNums(assunto.numerosErrados);
  const conhec = assunto.conhecimentoExigido
    ? `Conteúdo da prova: ${assunto.conhecimentoExigido}. `
    : "";
  const dif = assunto.nivelDificuldade ? `Dificuldade ${assunto.nivelDificuldade}. ` : "";

  if (recoveryMode) {
    return (
      `${conhec}${dif}` +
      `1) Releia com calma as questões erradas (${nums}). ` +
      `2) Escreva meia página de teoria sobre ${assunto.assunto}. ` +
      `3) Faça 12 questões novas do assunto e corrija anotando o padrão do erro.`
    );
  }
  return (
    `${conhec}${dif}` +
    `1) Diagnóstico: nas questões nº ${nums}, identifique se o erro foi conteúdo, interpretação ou tempo. ` +
    `2) Teoria (25 min): mapa mental de ${assunto.assunto} com o que a banca cobrou. ` +
    `3) Prática (35 min): 25 questões do assunto, cronometradas. ` +
    `4) Fechamento: no caderno, 3 regras que você não pode repetir neste tema.`
  );
}

function blocoFocoProfundo(
  assunto: AssuntoPrioritario,
  mat: MateriaErroResumo,
  ordem: number,
  recoveryMode: boolean
): StudyPlanItem {
  return {
    ordem,
    titulo: `${assunto.materia} — ${assunto.assunto}`,
    descricao: etapasProfundas(assunto, recoveryMode),
    duracaoMin: recoveryMode ? 50 : 75,
    numerosQuestoes: assunto.numerosErrados,
    conhecimentoExigido: assunto.conhecimentoExigido,
    nivelDificuldade: assunto.nivelDificuldade,
    bloco: "foco_profundo",
    materiaDestaque: mat.materia,
    errosNaMateria: mat.erros,
    geraQuest: true,
  };
}

function blocoConsolidacao(
  mat: MateriaErroResumo,
  ordem: number,
  recoveryMode: boolean
): StudyPlanItem {
  const pct = mat.total > 0 ? Math.round((mat.acertos / mat.total) * 100) : 0;
  const nums = formatNums(mat.numerosErrados, 8);
  return {
    ordem,
    titulo: `${mat.materia} — consolidar base`,
    descricao: recoveryMode
      ? `Você teve ${mat.erros} erro(s) e ${pct}% de acerto nesta matéria na prova. Revisão equilibrada: releia nº ${nums || "—"}, resumo curto de teoria e 15 questões variadas (sem pressa).`
      : `Desempenho misto (${pct}% acerto, ${mat.erros} erro(s) — questões nº ${nums || "—"}). ` +
          `1) Revisar teoria geral da matéria (20 min). ` +
          `2) 20 questões de assuntos variados (não só um tema). ` +
          `3) Comparar com os erros da prova — o que ainda vaza?`,
    duracaoMin: recoveryMode ? 35 : 50,
    numerosQuestoes: mat.numerosErrados,
    bloco: "consolidacao",
    materiaDestaque: mat.materia,
    errosNaMateria: mat.erros,
    geraQuest: true,
  };
}

function blocoManutencao(mat: MateriaErroResumo, ordem: number): StudyPlanItem {
  const pct = mat.total > 0 ? Math.round((mat.acertos / mat.total) * 100) : 0;
  return {
    ordem,
    titulo: `${mat.materia} — manter nível`,
    descricao:
      `Bom desempenho na prova (${pct}% de acerto em ${mat.total} questões). ` +
      `Manutenção: 8 questões de nível médio + 1 leitura de 10 min para não perder ritmo. ` +
      `Não pule esta matéria — vestibular exige constância em tudo.`,
    duracaoMin: 25,
    bloco: "manutencao",
    materiaDestaque: mat.materia,
    errosNaMateria: 0,
    geraQuest: true,
  };
}

export function generateStudyPlan(
  diagnosis: DiagnosisResult,
  options?: { ehProvaOficial?: boolean }
): {
  items: StudyPlanItem[];
  recoveryMode: boolean;
} {
  const recoveryMode = diagnosis.recoveryMode;
  const items: StudyPlanItem[] = [];
  let ordem = 1;
  const resumo = diagnosis.resumoProva;

  if (resumo && resumo.todasMaterias.length > 0) {
    const { criticas, atencao, solidas } = classificarMaterias(resumo);
    const listaMaterias = resumo.todasMaterias.map((m) => m.materia).join(", ");

    items.push({
      ordem: ordem++,
      titulo: "Panorama da prova",
      descricao:
        `Você analisou ${resumo.total} questões: ${resumo.acertos} acertos (${resumo.pctAcerto}%) e ${resumo.erros} erros (${resumo.pctErro}%). ` +
        `Matérias na prova: ${listaMaterias}. ` +
        `Este plano não é só lista de erros: há correção profunda onde mais falhou, consolidação nas outras áreas da prova, manutenção do que já vai bem e blocos de integração.`,
      duracaoMin: 0,
      bloco: "contexto",
      geraQuest: false,
    });

    const maxCriticas = recoveryMode ? 1 : 2;
    const assuntosPorMateriaCritica = recoveryMode ? 1 : 2;
    const maxAtencao = recoveryMode ? 1 : Math.min(3, atencao.length);
    const maxSolidas = recoveryMode ? 1 : Math.min(2, solidas.length);

    for (const mat of criticas.slice(0, maxCriticas)) {
      const pct = mat.total > 0 ? Math.round((mat.acertos / mat.total) * 100) : 0;
      items.push({
        ordem: ordem++,
        titulo: `Onde mais falhou — ${mat.materia}`,
        descricao:
          `${mat.erros} erro(s) de ${mat.total} questões (${pct}% acerto). ` +
          `Questões erradas: nº ${formatNums(mat.numerosErrados, 18)}. ` +
          `Blocos abaixo = estudo profundo (teoria + prática + caderno), não só repetir questão.`,
        duracaoMin: 0,
        bloco: "prioridade_materia",
        materiaDestaque: mat.materia,
        errosNaMateria: mat.erros,
        numerosQuestoes: mat.numerosErrados,
        geraQuest: false,
      });

      const assuntosDaMateria = resumo.assuntosPrioritarios
        .filter((a) => a.materia === mat.materia)
        .slice(0, assuntosPorMateriaCritica);

      if (assuntosDaMateria.length > 0) {
        for (const a of assuntosDaMateria) {
          items.push(blocoFocoProfundo(a, mat, ordem++, recoveryMode));
        }
      } else {
        items.push({
          ordem: ordem++,
          titulo: `${mat.materia} — estudo profundo geral`,
          descricao: etapasProfundas(
            {
              materia: mat.materia,
              assunto: "Revisão integrada da matéria",
              erros: mat.erros,
              numerosErrados: mat.numerosErrados,
              conhecimentoExigido: null,
              nivelDificuldade: null,
            },
            recoveryMode
          ),
          duracaoMin: recoveryMode ? 45 : 70,
          numerosQuestoes: mat.numerosErrados,
          bloco: "foco_profundo",
          materiaDestaque: mat.materia,
          errosNaMateria: mat.erros,
          geraQuest: true,
        });
      }
    }

    if (atencao.length > 0) {
      items.push({
        ordem: ordem++,
        titulo: "Consolidar o restante da prova",
        descricao:
          "Matérias em que você não foi tão mal quanto nas prioridades, mas ainda precisa de revisão — para o plano ficar completo e não deixar buracos.",
        duracaoMin: 0,
        bloco: "contexto",
        geraQuest: false,
      });
      for (const mat of atencao.slice(0, maxAtencao)) {
        items.push(blocoConsolidacao(mat, ordem++, recoveryMode));
      }
    }

    if (solidas.length > 0) {
      items.push({
        ordem: ordem++,
        titulo: "Manter o que já está forte",
        descricao:
          "Não abandonar matérias com bom desempenho na prova — vestibular cobra amplitude. Blocos curtos de manutenção.",
        duracaoMin: 0,
        bloco: "contexto",
        geraQuest: false,
      });
      for (const mat of solidas.slice(0, maxSolidas)) {
        items.push(blocoManutencao(mat, ordem++));
      }
    }

    const materiasFoco = criticas.map((m) => m.materia).join(" e ");
    items.push({
      ordem: ordem++,
      titulo: "Integração — mini-simulado da semana",
      descricao: recoveryMode
        ? `30 questões mistas (inclua ${materiasFoco || "as matérias da prova"}). Sem cronômetro rígido; foque em entender.`
        : `40–50 questões no estilo da banca, misturando ${listaMaterias}. ` +
            `Cronometre 2 blocos de 45 min. Ao final, marque acertos e relacione com os erros da prova original.`,
      duracaoMin: recoveryMode ? 50 : 90,
      bloco: "integracao",
      geraQuest: true,
    });

    items.push({
      ordem: ordem++,
      titulo: "Integração — caderno de correções",
      descricao:
        "Abra a prova registrada e, para cada questão errada prioritária: escreva o que a banca cobrou, por que você errou e uma regra para não repetir. " +
        "Meta: fechar 80% das lacunas listadas no plano até o fim da semana.",
      duracaoMin: recoveryMode ? 30 : 45,
      bloco: "integracao",
      geraQuest: true,
    });
  } else {
    const focos = diagnosis.focos.slice(0, recoveryMode ? 2 : 4);
    focos.forEach((foco) => {
      const assunto = foco.assunto ?? foco.label.split(" — ")[1] ?? foco.label;
      const tipoLabel = foco.tipoErroDominante
        ? getTipoErroLabel(foco.tipoErroDominante)
        : null;
      items.push({
        ordem: ordem++,
        titulo: foco.label,
        descricao:
          `Estudo em 4 passos: diagnóstico das questões erradas, teoria de ${assunto}, 20 questões novas` +
          (tipoLabel ? ` (atenção a ${tipoLabel})` : "") +
          `, fechamento no caderno.`,
        materiaId: foco.materiaId,
        temaId: foco.temaId,
        tipoErro: foco.tipoErroDominante,
        duracaoMin: recoveryMode ? 40 : 60,
        numerosQuestoes: foco.numerosErrados,
        conhecimentoExigido: foco.conhecimentoExigido,
        nivelDificuldade: foco.nivelDificuldade,
        bloco: "foco_profundo",
        geraQuest: true,
      });
    });
  }

  const proximo =
    options?.ehProvaOficial === false
      ? "No próximo simulado da mesma banca, compare acertos nas matérias que mais falharam e nas que consolidou."
      : "Na próxima prova da mesma banca, avalie se melhorou nas matérias críticas e se manteve as que já iam bem.";

  items.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao: recoveryMode
      ? "Completar os blocos na ordem, sem pular integração. Qualidade > quantidade."
      : `${proximo} Tempo total sugerido do plano: ${recoveryMode ? "3–4h" : "6–9h"} distribuídas na semana.`,
    duracaoMin: recoveryMode ? 15 : 20,
    bloco: "meta",
    geraQuest: false,
  });

  return { items, recoveryMode };
}

export function planToQuests(
  items: StudyPlanItem[],
  userId: string
): Array<{
  userId: string;
  titulo: string;
  descricao: string;
  materiaId?: string;
  temaId?: string;
  duracaoMin: number;
  rewardMsg: string;
}> {
  return items
    .filter((item) => item.geraQuest !== false && item.duracaoMin > 0)
    .map((item) => {
      const onde =
        item.errosContexto === "prova" ? "na prova" : "na jornada";
      const erros =
        item.numerosQuestoes?.length &&
        item.errosNaMateria != null &&
        item.errosNaMateria > 0
          ? ` (${item.errosNaMateria} erro${item.errosNaMateria > 1 ? "s" : ""} ${onde})`
          : "";
      return {
        userId,
        titulo: item.titulo,
        descricao: item.descricao + erros,
        materiaId: item.materiaId,
        temaId: item.temaId,
        duracaoMin: item.duracaoMin,
        rewardMsg:
          item.bloco === "integracao"
            ? "Integrar o que estudou com a prova real é o que transforma diagnóstico em nota."
            : item.conhecimentoExigido
              ? `Dominar ${item.titulo} fecha uma lacuna que a prova já mostrou.`
              : `Bloco completo: ${item.titulo}. Plano equilibrado = prioridade + base + manutenção.`,
      };
    });
}
