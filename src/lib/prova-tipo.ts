import type { ProvaTipo } from "@/generated/prisma/client";

/** Provas de vestibular/ENEM — base do diagnóstico e dos focos */
export const TIPOS_PROVA_OFICIAL: ProvaTipo[] = ["ENEM_OFICIAL", "VESTIBULAR"];

/** Simulados de cursinho etc. — termômetro da evolução nos focos */
export const TIPOS_SIMULADO: ProvaTipo[] = ["SIMULADO", "OUTRO"];

export type AbaProvasAluno = "oficiais" | "simulados";

export function abaFromSearchParam(aba: string | undefined): AbaProvasAluno {
  return aba === "simulados" ? "simulados" : "oficiais";
}

export function provaEhOficial(tipo: ProvaTipo): boolean {
  return TIPOS_PROVA_OFICIAL.includes(tipo);
}

export function filtrarProvasPorAba<T extends { tipo: ProvaTipo }>(
  provas: T[],
  aba: AbaProvasAluno
): T[] {
  const tipos = aba === "oficiais" ? TIPOS_PROVA_OFICIAL : TIPOS_SIMULADO;
  return provas.filter((p) => tipos.includes(p.tipo));
}

export function labelTipoProva(tipo: ProvaTipo): string {
  const map: Record<ProvaTipo, string> = {
    ENEM_OFICIAL: "ENEM oficial",
    VESTIBULAR: "Vestibular",
    SIMULADO: "Simulado",
    OUTRO: "Outro",
  };
  return map[tipo] ?? tipo;
}
