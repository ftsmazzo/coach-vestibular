/**
 * Plano semanal da jornada — motor v1 (focosPedagogicos por escopo N2).
 */
import { buildResumoJornada } from "@/lib/jornada";
import { formatarPassos } from "@/lib/copiloto-passos";
import type { StudyPlanItem } from "@/lib/study-plan";
import { materiasComDadosReais } from "@/lib/jornada-analytics";
import { aggregateJourneyLearning } from "@/lib/jornada-analytics";
import { getAnamneseMotorContext } from "@/lib/anamnese-motor";
import { getFocosPedagogicosRecentes } from "@/lib/learning-motor-foco";

function blocosPlanoSóAnamnese(
  anamneseCtx: Awaited<ReturnType<typeof getAnamneseMotorContext>>,
  ordemInicial: number
): StudyPlanItem[] {
  const items: StudyPlanItem[] = [];
  let ordem = ordemInicial;
  const weak = anamneseCtx.profile?.academicSelfPerception?.perceivedWeakSubjects ?? [];
  const strong = anamneseCtx.profile?.academicSelfPerception?.perceivedStrongSubjects ?? [];

  items.push({
    ordem: ordem++,
    titulo: "O que você contou na conversa inicial",
    descricao:
      (anamneseCtx.summary ?? anamneseCtx.focoInicialDescricao ?? "") +
      "\n\nAinda não há provas registradas — este plano vem da sua anamnese. " +
      "Quando registrar provas do catálogo, o copiloto cruza o que você disse com seus erros reais por escopo.",
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "jornada",
  });

  if (anamneseCtx.focoInicialTitulo) {
    items.push({
      ordem: ordem++,
      titulo: `Prioridade 1 — ${anamneseCtx.focoInicialTitulo}`,
      descricao:
        (anamneseCtx.focoInicialDescricao ?? "Foco inicial a partir da sua jornada.") +
        (weak.length
          ? `\n\nMatérias que você sinalizou como mais difíceis: ${weak.join(", ")}.`
          : "") +
        (strong.length ? `\nOnde você se sente mais forte: ${strong.join(", ")}.` : "") +
        "\n\nPasso a passo prático → Quests → O que fazer agora.",
      duracaoMin: 40,
      bloco: "foco_profundo",
      materiaDestaque: weak[0] ?? undefined,
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  if (anamneseCtx.profile?.examBehavior?.fatigueInLongExams) {
    items.push({
      ordem: ordem++,
      titulo: "Também vale atenção — clareza em prova longa",
      descricao:
        "Você comentou que perde clareza em provas longas. Quando fizer simulados, marque em qual bloco de questões a cabeça cansou — isso vira dado real para o copiloto.",
      duracaoMin: 0,
      bloco: "consolidacao",
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  items.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao:
      "Completar os passos em Quests. Registrar provas do catálogo classificadas (N2) para o plano usar escopos reais.",
    duracaoMin: 0,
    bloco: "meta",
    geraQuest: false,
  });

  return items;
}

export async function buildPlanoSemanalCopiloto(userId: string): Promise<{
  items: StudyPlanItem[];
  recoveryMode: boolean;
  fonte: "jornada" | "anamnese" | "vazio";
}> {
  const [resumo, analytics, anamneseCtx, focosPedagogicos] = await Promise.all([
    buildResumoJornada(userId),
    aggregateJourneyLearning(userId, "todos"),
    getAnamneseMotorContext(userId),
    getFocosPedagogicosRecentes(userId, 3),
  ]);

  const recoveryMode = resumo.pctAcertoPonderado < 50 && resumo.totalRegistros >= 2;
  const items: StudyPlanItem[] = [];
  let ordem = 1;

  const registrosLabel =
    resumo.totalRegistros === 1
      ? "1 registro na jornada"
      : `${resumo.totalRegistros} registros na jornada`;

  const introAnamnese =
    resumo.totalRegistros === 0 && anamneseCtx.completed
      ? "Por enquanto o plano vem da **conversa inicial** (anamnese). "
      : "";

  const geradoEm = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  items.push({
    ordem: ordem++,
    titulo: "Sua semana na jornada",
    descricao:
      `Atualizado pelo copiloto em ${geradoEm}.\n\n` +
      introAnamnese +
      (resumo.totalRegistros > 0
        ? `Este plano usa **todos os ${registrosLabel}** — acerto ponderado: ${resumo.pctAcertoPonderado}%. `
        : "Registre provas do catálogo quando puder para cruzar com o que você já contou. ") +
      `Passo a passo em Quests → O que fazer agora.`,
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "jornada",
  });

  if (focosPedagogicos.length === 0) {
    if (anamneseCtx.completed) {
      items.push(...blocosPlanoSóAnamnese(anamneseCtx, ordem));
      return { items, recoveryMode, fonte: "anamnese" };
    }
    items.push({
      ordem: ordem++,
      titulo: "Meta da semana",
      descricao:
        "Faça a conversa inicial na Home e registre provas do catálogo (classificadas no admin) para o copiloto montar passos por escopo.",
      duracaoMin: 10,
      bloco: "meta",
      geraQuest: false,
    });
    return { items, recoveryMode, fonte: "vazio" };
  }

  const focoEscopo = focosPedagogicos[0]!;
  let metaFocoLabel = `${focoEscopo.escopoLabel} em ${focoEscopo.materiaLabel}`;

  items.push({
    ordem: ordem++,
    titulo: `Prioridade 1 — ${focoEscopo.escopoLabel}`,
    descricao:
      `${focoEscopo.hipoteseCausa}\n\n` +
      `Objetivo da semana: ${focoEscopo.objetivoDaSemana}\n\n` +
      formatarPassos(
        [
          `Escopo: ${focoEscopo.escopoLabel} (${focoEscopo.materiaLabel}).`,
          `Revise questões ${focoEscopo.numerosErrados.slice(0, 6).join(", ")} da jornada.`,
          "Corrija com gabarito e anote o passo que faltou.",
          "Faça 3 exercícios novos só desse escopo.",
        ],
        `foco calculado pelo motor (${focoEscopo.totalErros} erro(s) neste escopo).`,
        recoveryMode ? 35 : 45
      ),
    duracaoMin: recoveryMode ? 35 : 45,
    bloco: "foco_profundo",
    materiaDestaque: focoEscopo.materiaLabel,
    geraQuest: false,
    errosContexto: "jornada",
  });

  if (!recoveryMode) {
    const fpSecundario = focosPedagogicos[1];
    if (fpSecundario) {
      items.push({
        ordem: ordem++,
        titulo: `Também vale atenção — ${fpSecundario.escopoLabel}`,
        descricao: formatarPassos(
          [
            `${fpSecundario.materiaLabel}: ${fpSecundario.hipoteseCausa}`,
            `Questões ${fpSecundario.numerosErrados.slice(0, 4).join(", ")}.`,
            "Refaça com calma e compare com o gabarito.",
          ],
          "segundo foco por escopo na jornada.",
          35
        ),
        duracaoMin: 35,
        bloco: "consolidacao",
        materiaDestaque: fpSecundario.materiaLabel,
        geraQuest: false,
        errosContexto: "jornada",
      });
    }
  }

  const materiasBase = materiasComDadosReais(analytics.materiasMedia, 5);
  const solidas = materiasBase.filter((m) => m.pctAcerto >= 65).slice(0, recoveryMode ? 0 : 1);
  for (const m of solidas) {
    items.push({
      ordem: ordem++,
      titulo: `${m.label} — manter ritmo`,
      descricao: formatarPassos(
        [
          `Você está com ${m.pctAcerto}% de acerto ponderado em ${m.label} na jornada.`,
          "Faça 8 questões de nível médio (não pule esta matéria).",
          "Corrija e siga para o próximo bloco.",
        ],
        "manter o que já funciona enquanto ataca o déficit.",
        25
      ),
      duracaoMin: 25,
      bloco: "manutencao",
      materiaDestaque: m.label,
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  items.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao:
      `Completar os blocos na ordem. O foco central é ${metaFocoLabel}. ` +
      `Tempo total sugerido: ${recoveryMode ? "2–3h" : "4–6h"} distribuídas na semana. ` +
      `Depois de registrar uma nova prova, use "Regenerar plano" para atualizar com a jornada inteira.`,
    duracaoMin: 0,
    bloco: "meta",
    geraQuest: false,
    errosContexto: "jornada",
  });

  return { items, recoveryMode, fonte: "jornada" };
}
