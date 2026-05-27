import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { aplicarMapaEnem, questoesFromListaErros } from "@/lib/gabarito";
import { createExamWithDiagnosis, type QuestionInput } from "@/lib/exam-service";
import {
  MAX_LISTAS_POR_SEMANA,
  MAX_QUESTOES_LISTA,
} from "@/lib/lista-exercicios-constants";
import { prisma } from "@/lib/prisma";

export {
  MAX_QUESTOES_LISTA,
  MAX_LISTAS_POR_SEMANA,
  mensagemErroLista,
  ehListaPessoal,
} from "@/lib/lista-exercicios-constants";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function contarListasNaSemana(userId: string): Promise<number> {
  const weekStart = getWeekStart(new Date());
  return prisma.exam.count({
    where: {
      userId,
      provaId: null,
      createdAt: { gte: weekStart },
    },
  });
}

export function buildQuestoesLista(
  totalQuestoes: number,
  apenasErros: number[]
): QuestionInput[] {
  const base = questoesFromListaErros(totalQuestoes, apenasErros);
  return aplicarMapaEnem(base, totalQuestoes);
}

export type RegistrarListaInput = {
  userId: string;
  nome: string;
  data: string;
  totalQuestoes: number;
  apenasErros: number[];
  checkInScore?: number;
};

export async function registrarListaExercicios(input: RegistrarListaInput) {
  if (!input.nome.trim()) throw new Error("NOME_OBRIGATORIO");
  if (!input.data.trim()) throw new Error("DATA_OBRIGATORIA");
  if (input.totalQuestoes < 1 || input.totalQuestoes > MAX_QUESTOES_LISTA) {
    throw new Error("TOTAL_QUESTOES_INVALIDO");
  }
  if (input.apenasErros.length === 0) {
    throw new Error("ERROS_OBRIGATORIOS");
  }
  if (input.apenasErros.some((n) => n < 1 || n > input.totalQuestoes)) {
    throw new Error("ERRO_FORA_INTERVALO");
  }

  const naSemana = await contarListasNaSemana(input.userId);
  if (naSemana >= MAX_LISTAS_POR_SEMANA) {
    throw new Error("LIMITE_SEMANAL");
  }

  const questoes = buildQuestoesLista(input.totalQuestoes, input.apenasErros);

  return createExamWithDiagnosis({
    userId: input.userId,
    nome: input.nome.trim(),
    data: input.data,
    banca: "Lista pessoal",
    totalQuestoes: input.totalQuestoes,
    checkInScore: input.checkInScore,
    questoes,
    modoUso: "TREINO" satisfies ModoUsoRegistro,
    provaTipoDiagnostico: "LISTA_FIXACAO",
  });
}
