import type { ModoUsoRegistro, ProvaTipo } from "@/generated/prisma/client";
import { provaEhOficial } from "@/lib/prova-tipo";

export const PESO_MODO_USO: Record<ModoUsoRegistro, number> = {
  OFICIAL: 3,
  TREINO: 1.5,
  REVISAO_PROVA_ANTIGA: 1,
};

import { XP_VALORES } from "@/lib/xp";

export { XP_VALORES };
export const XP_SUGESTAO_ACEITA = XP_VALORES.SUGESTAO_ACEITA;

export function pesoModoUso(modo: ModoUsoRegistro): number {
  return PESO_MODO_USO[modo] ?? 1.5;
}

export function labelModoUso(modo: ModoUsoRegistro): string {
  const map: Record<ModoUsoRegistro, string> = {
    OFICIAL: "Prova oficial (ENEM / vestibular)",
    TREINO: "Treino (simulado ou lista)",
    REVISAO_PROVA_ANTIGA: "Revisão de prova antiga",
  };
  return map[modo] ?? modo;
}

export function descricaoModoUso(modo: ModoUsoRegistro): string {
  const map: Record<ModoUsoRegistro, string> = {
    OFICIAL:
      "Simulou o dia da prova ou fez oficial — pesa mais no seu plano e na jornada.",
    TREINO:
      "Simulado de cursinho ou lista de exercícios — acompanha evolução e reforço.",
    REVISAO_PROVA_ANTIGA:
      "Refiz questões de prova de outro ano para treinar — peso menor, mas conta na evolução.",
  };
  return map[modo] ?? "";
}

/** Sugestão inicial ao abrir o formulário de registro */
export function modoUsoPadraoParaProva(tipo: ProvaTipo): ModoUsoRegistro {
  if (tipo === "LISTA_FIXACAO") return "TREINO";
  if (provaEhOficial(tipo)) return "OFICIAL";
  if (tipo === "SIMULADO" || tipo === "OUTRO") return "TREINO";
  return "TREINO";
}

export function modoUsoFromString(v: string | undefined | null): ModoUsoRegistro | null {
  if (v === "OFICIAL" || v === "TREINO" || v === "REVISAO_PROVA_ANTIGA") return v;
  return null;
}

export const OPCOES_MODO_USO: ModoUsoRegistro[] = [
  "OFICIAL",
  "TREINO",
  "REVISAO_PROVA_ANTIGA",
];

/** Peso efetivo para diagnóstico/plano: prioriza modoUso do registro */
export function pesoEfetivoRegistro(modoUso: ModoUsoRegistro, provaTipo?: ProvaTipo | null): number {
  return pesoModoUso(modoUso);
}
