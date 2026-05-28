/**
 * Passos acionáveis compartilhados — Home, alavancas, plano semanal e quests.
 */
import type { PedagogicalClusterId } from "@/lib/pedagogical-clusters";

export function formatarPassos(passos: string[], porQue: string, duracaoMin: number): string {
  const lista = passos.map((p, i) => `${i + 1}. ${p}`).join("\n");
  return `Por que agora: ${porQue}\n\nO que fazer (~${duracaoMin} min):\n${lista}\n\nPronto quando: você tiver feito todos os passos e corrigido o que errou.`;
}

export const PASSOS_POR_CLUSTER: Record<PedagogicalClusterId, string[]> = {
  visualizacao_espacial: [
    "Separe um bloco sem celular (15–25 min).",
    "Escolha 3 questões de Matemática com figura, desenho ou geometria (pode ser das que você errou).",
    "Em cada questão: copie ou desenhe a figura no caderno e rotule ângulos e lados.",
    "Só depois monte a conta. Se travar, marque a questão com um X para rever amanhã.",
    "No fim, escreva 1 frase: o que mais te travou?",
  ],
  modelagem_matematica: [
    "Escolha 3 questões de Matemática com texto longo ou dados no enunciado.",
    "Antes de calcular, escreva em 1 linha: o que a questão pede? Qual modelo (equação, proporção, gráfico)?",
    "Só então resolva. Corrija na hora.",
    "Repita até completar 3 questões com o modelo escrito antes da conta.",
  ],
  calculo_procedimento: [
    "Faça 10 questões de Matemática (tema que você já estudou).",
    "No papel, marque cada passo da conta (não pule etapas).",
    "Confira só o resultado final no fim de cada questão.",
    "Anote quantas escaparam por conta — meta: reduzir na próxima sessão.",
  ],
  interpretacao_textual: [
    "Pegue 2 questões com texto longo (qualquer matéria).",
    "1ª leitura: só ideia central (2 min).",
    "2ª leitura: sublinhe só o que responde ao comando da questão.",
    "Responda e corrija. Repita no segundo texto.",
  ],
  analise_linguistica: [
    "Escolha 1 regra de gramática que mais apareceu nos seus erros.",
    "10 min: releia a teoria (resumo ou video curto).",
    "Faça 10 questões só dessa regra.",
    "Corrija e anote o erro que se repetiu.",
  ],
  recuperacao_conceitual: [
    "Escolha 1 tema que você já estudou mas errou na prova.",
    "Faça 5 cartões: pergunta de um lado, conceito do outro.",
    "Responda os cartões sem olhar material.",
    "Depois faça 5 questões desse tema.",
  ],
  comparacao_contextual: [
    "Escolha 3 questões de Humanas que pedem comparar.",
    "Monte um quadro: semelhança | diferença | conclusão.",
    "Responda usando o quadro. Corrija.",
  ],
  inferencia_logica: [
    "Faça 5 questões que exijam encadear raciocínio.",
    "Ao lado de cada uma escreva: premissa → passo → conclusão.",
    "Só marque a alternativa depois de escrever os passos.",
  ],
  aplicacao_conceitual: [
    "Escolha 1 tema que você domina em um tipo de questão.",
    "Faça 10 questões do mesmo tema em enunciados diferentes (outra banca ou outro contexto).",
    "Corrija e veja se o erro é conteúdo ou leitura do enunciado novo.",
  ],
};
