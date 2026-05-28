/**
 * Tipos cognitivos derivados de conhecimentoExigido — eixo principal do diagnóstico.
 */
import type { ErrorType } from "@/generated/prisma/client";

export type TipoCognitivoId =
  | "linguagem"
  | "interpretacao"
  | "leitura"
  | "inferencia"
  | "logica"
  | "abstracao"
  | "visualizacao"
  | "modelagem"
  | "comparacao"
  | "recuperacao_conceitual"
  | "aplicacao"
  | "calculo"
  | "outro";

export type TipoCognitivoDef = {
  id: TipoCognitivoId;
  label: string;
  verboTreino: string;
};

export const TIPOS_COGNITIVOS: TipoCognitivoDef[] = [
  {
    id: "linguagem",
    label: "Análise linguística",
    verboTreino: "analisar estrutura da oração (sujeito, objeto, funções sintáticas)",
  },
  { id: "interpretacao", label: "Interpretação", verboTreino: "interpretar enunciados e alternativas" },
  { id: "leitura", label: "Leitura aplicada", verboTreino: "ler e extrair informação do texto-base" },
  { id: "inferencia", label: "Inferência", verboTreino: "inferir conclusões a partir de dados" },
  { id: "logica", label: "Raciocínio lógico", verboTreino: "encadear raciocínio sem pular etapas" },
  { id: "abstracao", label: "Abstração", verboTreino: "abstrair conceitos a partir de situações" },
  {
    id: "visualizacao",
    label: "Visualização espacial",
    verboTreino: "visualizar relações espaciais, gráficos e figuras",
  },
  {
    id: "modelagem",
    label: "Modelagem matemática",
    verboTreino: "transformar o problema em equação, gráfico ou modelo",
  },
  { id: "comparacao", label: "Comparação", verboTreino: "comparar alternativas e casos" },
  {
    id: "recuperacao_conceitual",
    label: "Recuperação conceitual",
    verboTreino: "recuperar conceito teórico na hora da prova",
  },
  { id: "aplicacao", label: "Aplicação prática", verboTreino: "aplicar conceito em contexto novo" },
  { id: "calculo", label: "Cálculo e procedimento", verboTreino: "executar cálculos com precisão" },
  { id: "outro", label: "Demanda específica", verboTreino: "" },
];

/** Ordem importa: regras mais específicas primeiro. */
const REGRAS: Array<{ id: TipoCognitivoId; patterns: RegExp[] }> = [
  {
    id: "linguagem",
    patterns: [
      /sujeito/i,
      /objeto\s+(direto|indireto)/i,
      /pleon/i,
      /oração/i,
      /orac/i,
      /sintax/i,
      /morfolog/i,
      /segmento.*função/i,
      /função\s+de\s+sujeito/i,
      /concord/i,
      /regência/i,
      /crase/i,
    ],
  },
  {
    id: "calculo",
    patterns: [/calcul/i, /conta\b/i, /operac/i, /operação aritm/i, /raiz\b/i, /porcentagem/i, /mmc|mdc/i],
  },
  {
    id: "visualizacao",
    patterns: [
      /espacial/i,
      /gráfico/i,
      /grafico/i,
      /figura/i,
      /geometr/i,
      /ângulo/i,
      /angulo/i,
      /vetor/i,
      /coordenada/i,
      /plano cartesiano/i,
    ],
  },
  {
    id: "modelagem",
    patterns: [
      /equa[cç][ãa]o/i,
      /fun[cç][ãa]o\s+(linear|quadr|expon|log)/i,
      /modelo\s+matem/i,
      /vari[aá]vel/i,
      /montar\s+equa/i,
      /expressão\s+algébrica/i,
    ],
  },
  {
    id: "comparacao",
    patterns: [/compar/i, /diferen[cç]a entre/i, /versus/i, /contraste/i, /semelhan/i],
  },
  {
    id: "inferencia",
    patterns: [/infer/i, /conclu/i, /deduz/i, /implic/i, /pressup/i],
  },
  {
    id: "leitura",
    patterns: [
      /compreens[aã]o\s+de\s+texto/i,
      /texto-base/i,
      /trecho/i,
      /par[aá]grafo/i,
      /crônica/i,
      /autor\b/i,
      /filosófic/i,
      /filosofic/i,
      /montaigne/i,
      /visão\s+de\s+/i,
    ],
  },
  {
    id: "interpretacao",
    patterns: [/interpret/i, /sentido/i, /signific/i, /alternativa/i, /enunciado/i],
  },
  {
    id: "logica",
    patterns: [/lógic/i, /logic/i, /raciocínio/i, /raciocinio/i, /encade/i, /sequência/i],
  },
  {
    id: "abstracao",
    patterns: [/abstr/i, /generaliz/i, /categor/i],
  },
  {
    id: "recuperacao_conceitual",
    patterns: [/recordar/i, /lembrar/i, /definir\s+o\s+conceito/i, /lei\s+de/i, /teorema/i, /fórmula de/i],
  },
  { id: "aplicacao", patterns: [/aplicar/i, /situa[cç][ãa]o\s+problema/i, /cotidiano/i, /contexto real/i] },
];

export function inferirTipoCognitivo(conhecimentoExigido: string): TipoCognitivoDef {
  const t = conhecimentoExigido.trim();
  if (!t) return TIPOS_COGNITIVOS.find((x) => x.id === "outro")!;

  for (const regra of REGRAS) {
    if (regra.patterns.some((p) => p.test(t))) {
      return TIPOS_COGNITIVOS.find((x) => x.id === regra.id)!;
    }
  }
  return TIPOS_COGNITIVOS.find((x) => x.id === "outro")!;
}

export type CausaErroLacuna = {
  tipo: ErrorType;
  label: string;
  count: number;
  pct?: number;
};

export type ClusterCognitivo = {
  tipo: TipoCognitivoId;
  label: string;
  verboTreino: string;
  erros: number;
  errosPonderados: number;
  scoreImpacto: number;
  exemplosConhecimento: string[];
  materias: string[];
  causaDominante: CausaErroLacuna | null;
};

function normMateria(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function materiaCoincide(a: string, b: string): boolean {
  const na = normMateria(a);
  const nb = normMateria(b);
  return na.includes(nb) || nb.includes(na);
}

export function agruparPorTipoCognitivo(
  lacunas: Array<{
    texto: string;
    materia: string | null;
    erros: number;
    errosPonderados: number;
    scoreImpacto: number;
    causaDominante: CausaErroLacuna | null;
  }>
): ClusterCognitivo[] {
  const map = new Map<TipoCognitivoId, ClusterCognitivo & { _causas: Map<ErrorType, number> }>();

  for (const l of lacunas) {
    const tipo = inferirTipoCognitivo(l.texto);
    const c =
      map.get(tipo.id) ??
      ({
        tipo: tipo.id,
        label: tipo.id === "outro" ? resumirConhecimento(tipo.label, l.texto) : tipo.label,
        verboTreino: tipo.verboTreino || resumirConhecimento("", l.texto),
        erros: 0,
        errosPonderados: 0,
        scoreImpacto: 0,
        exemplosConhecimento: [],
        materias: [],
        causaDominante: null,
        _causas: new Map(),
      } as ClusterCognitivo & { _causas: Map<ErrorType, number> });

    c.erros += l.erros;
    c.errosPonderados += l.errosPonderados;
    c.scoreImpacto += l.scoreImpacto;
    if (c.exemplosConhecimento.length < 3) c.exemplosConhecimento.push(l.texto);
    if (l.materia && !c.materias.includes(l.materia)) c.materias.push(l.materia);
    if (l.causaDominante) {
      c._causas.set(
        l.causaDominante.tipo,
        (c._causas.get(l.causaDominante.tipo) ?? 0) + l.causaDominante.count
      );
    }

    map.set(tipo.id, c);
  }

  return [...map.values()]
    .map(({ _causas, ...c }) => {
      const top = [..._causas.entries()].sort((a, b) => b[1] - a[1])[0];
      const causaDominante = top
        ? {
            tipo: top[0],
            label: top[0],
            count: top[1],
          }
        : null;
      return { ...c, causaDominante };
    })
    .sort((a, b) => b.scoreImpacto - a.scoreImpacto);
}

function resumirConhecimento(_fallback: string, texto: string): string {
  const t = texto.trim();
  if (t.length <= 48) return t;
  const cut = t.slice(0, 45);
  const sp = cut.lastIndexOf(" ");
  return (sp > 20 ? cut.slice(0, sp) : cut) + "…";
}

export type FraseGargaloInput = {
  exemploConhecimento: string;
  tipoLabel: string;
  verboTreino: string;
  materia: string | null;
  pctAcertoMateria: number | null;
  erros: number;
  causaDominante: string | null;
  pctCausa: number | null;
  materiaDeficitPrincipal: string | null;
};

/** Diagnóstico em linguagem humana — conhecimento + déficit de matéria + metacognição. */
export function fraseGargaloProfundo(input: FraseGargaloInput): string {
  const partes: string[] = [];

  if (input.materiaDeficitPrincipal && input.materia && materiaCoincide(input.materia, input.materiaDeficitPrincipal)) {
    partes.push(
      `Seu maior déficit curricular hoje é ${input.materiaDeficitPrincipal}` +
        (input.pctAcertoMateria != null ? ` (${input.pctAcertoMateria}% na jornada)` : "") +
        `.`
    );
  }

  partes.push(`O que a banca mais cobrou e você errou: «${input.exemploConhecimento}».`);

  if (input.verboTreino) {
    partes.push(`Isso exige ${input.verboTreino}.`);
  }

  if (input.causaDominante && input.pctCausa != null && input.pctCausa >= 25) {
    partes.push(
      `Nos erros que você classificou neste tipo de questão, ${input.pctCausa}% foram por ${input.causaDominante.toLowerCase()} — vale atacar conteúdo e forma de pensar juntos.`
    );
  } else if (input.causaDominante) {
    partes.push(
      `Quando classifica erros, marque a causa — isso destrava um plano mais preciso do que só “estudar ${input.materia ?? "a matéria"}”.`
    );
  }

  return partes.join(" ");
}

export function tituloMissaoCognitiva(input: FraseGargaloInput): string {
  if (input.materiaDeficitPrincipal && input.materia && materiaCoincide(input.materia, input.materiaDeficitPrincipal)) {
    return `Fechar lacuna em ${input.materiaDeficitPrincipal}: ${input.tipoLabel}`;
  }
  if (input.tipoLabel !== "Demanda específica") {
    return `${input.tipoLabel} — prática dirigida`;
  }
  return resumirConhecimento("Prioridade da semana", input.exemploConhecimento);
}
