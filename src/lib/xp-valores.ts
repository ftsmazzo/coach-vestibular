/** Valores de XP por ação — sem dependências de servidor (safe para Client Components). */
export const XP_VALORES = {
  SUGESTAO_ACEITA: 25,
  MELHORIA_MATERIA: 10,
  QUESTS_SEMANA: 50,
  PRIMEIRO_REGISTRO_SEMANA: 15,
  STREAK_3: 10,
  STREAK_7: 25,
} as const;

export const XP_SUGESTAO_ACEITA = XP_VALORES.SUGESTAO_ACEITA;

export const LABEL_TIPO_XP: Record<string, string> = {
  SUGESTAO_ACEITA: "Sugestão aceita pela equipe",
  MELHORIA_MATERIA: "Melhoria em matéria",
  QUESTS_SEMANA: "Quests da semana concluídas",
  PRIMEIRO_REGISTRO_SEMANA: "Primeiro registro da semana",
  STREAK_3: "3 dias seguidos com registro",
  STREAK_7: "7 dias seguidos com registro",
};

export type TipoXpEvento = keyof typeof XP_VALORES | "SUGESTAO_ACEITA";
