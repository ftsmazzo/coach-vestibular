import type { ProvaTipo } from "@/generated/prisma/client";

/** Provas de vestibular/ENEM — base do diagnóstico e dos focos */
export const TIPOS_PROVA_OFICIAL: ProvaTipo[] = ["ENEM_OFICIAL", "VESTIBULAR"];

/** Simulados de cursinho etc. — termômetro da evolução nos focos */
export const TIPOS_SIMULADO: ProvaTipo[] = ["SIMULADO", "OUTRO", "LISTA_FIXACAO"];

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
    LISTA_FIXACAO: "Lista de Fixação",
  };
  return map[tipo] ?? tipo;
}

/** Filtro nas listas do aluno (dashboard, meus registros) */
export type FiltroRegistros = "todos" | "provas" | "simulados";

export function filtroRegistrosFromSearchParam(v: string | undefined): FiltroRegistros {
  if (v === "provas" || v === "simulados") return v;
  return "todos";
}

export type CategoriaRegistro = "prova_oficial" | "simulado";

/** Classifica um Exam pelo tipo da Prova vinculada (UFU, ENEM = oficial; cursinho = simulado). */
export function categoriaDoRegistro(exam: {
  provaId: string | null;
  prova?: { tipo: ProvaTipo } | null;
}): CategoriaRegistro {
  if (exam.prova?.tipo) {
    return provaEhOficial(exam.prova.tipo) ? "prova_oficial" : "simulado";
  }
  return "simulado";
}

export function registroPassaFiltro(
  exam: { provaId: string | null; prova?: { tipo: ProvaTipo } | null },
  filtro: FiltroRegistros
): boolean {
  if (filtro === "todos") return true;
  const cat = categoriaDoRegistro(exam);
  return filtro === "provas" ? cat === "prova_oficial" : cat === "simulado";
}

export function labelCategoriaRegistro(cat: CategoriaRegistro): string {
  return cat === "prova_oficial" ? "Prova oficial" : "Simulado";
}

/** Marcador nos cards do dashboard (mais curto que labelCategoriaRegistro). */
export function labelMarcadorAtividade(cat: CategoriaRegistro): string {
  return cat === "prova_oficial" ? "Vestibular" : "Simulado";
}

/** Textos do diagnóstico genérico (antes do resumo concreto da prova). */
export function rotulosDiagnostico(cat: CategoriaRegistro) {
  return cat === "prova_oficial"
    ? {
        curto: "prova oficial",
        neste: "Nesta prova oficial",
        este: "Esta prova oficial",
        comparar: "suas últimas provas oficiais",
      }
    : {
        curto: "simulado",
        neste: "Neste simulado",
        este: "Este simulado",
        comparar: "seus últimos simulados",
      };
}
