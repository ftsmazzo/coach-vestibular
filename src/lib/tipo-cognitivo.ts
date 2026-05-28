/**
 * Tipos cognitivos derivados de conhecimentoExigido — eixo principal do diagnóstico.
 * Matéria/assunto ficam como contexto curricular.
 */

export type TipoCognitivoId =
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
  /** Frase para o aluno — o que treinar */
  verboTreino: string;
};

export const TIPOS_COGNITIVOS: TipoCognitivoDef[] = [
  { id: "interpretacao", label: "Interpretação", verboTreino: "interpretar enunciados e alternativas" },
  { id: "leitura", label: "Leitura aplicada", verboTreino: "ler e extrair informação do texto-base" },
  { id: "inferencia", label: "Inferência", verboTreino: "inferir conclusões a partir de dados" },
  { id: "logica", label: "Raciocínio lógico", verboTreino: "encadear raciocínio sem pular etapas" },
  { id: "abstracao", label: "Abstração", verboTreino: "abstrair conceitos a partir de situações" },
  { id: "visualizacao", label: "Visualização espacial", verboTreino: "visualizar relações espaciais e gráficos" },
  { id: "modelagem", label: "Modelagem", verboTreino: "transformar situação em modelo (fórmula, gráfico, esquema)" },
  { id: "comparacao", label: "Comparação", verboTreino: "comparar alternativas e casos" },
  {
    id: "recuperacao_conceitual",
    label: "Recuperação conceitual",
    verboTreino: "recuperar conceito teórico na hora da prova",
  },
  { id: "aplicacao", label: "Aplicação prática", verboTreino: "aplicar conceito em contexto novo" },
  { id: "calculo", label: "Cálculo e procedimento", verboTreino: "executar cálculos e procedimentos com precisão" },
  { id: "outro", label: "Operação cognitiva", verboTreino: "treinar o que a questão exigiu" },
];

const REGRAS: Array<{ id: TipoCognitivoId; patterns: RegExp[] }> = [
  {
    id: "visualizacao",
    patterns: [
      /espacial/i,
      /grafico/i,
      /gráfico/i,
      /figura/i,
      /geometr/i,
      /angulo/i,
      /ângulo/i,
      /vetor/i,
      /coordenada/i,
    ],
  },
  {
    id: "modelagem",
    patterns: [/model/i, /equac/i, /equação/i, /funcao/i, /função/i, /represent/i, /converter/i],
  },
  {
    id: "calculo",
    patterns: [/calcul/i, /conta/i, /operac/i, /operação/i, /numer/i, /númer/i, /formula/i, /fórmula/i],
  },
  {
    id: "comparacao",
    patterns: [/compar/i, /diferenc/i, /diferença/i, /versus/i, /relac/i, /relação/i, /contraste/i],
  },
  {
    id: "inferencia",
    patterns: [/infer/i, /conclu/i, /deduz/i, /implic/i, /pressup/i],
  },
  {
    id: "interpretacao",
    patterns: [/interpret/i, /sentido/i, /signific/i, /alternativa/i, /enunciado/i, /texto/i],
  },
  {
    id: "leitura",
    patterns: [/leitura/i, /compreens/i, /trecho/i, /paragrafo/i, /parágrafo/i, /autor/i],
  },
  {
    id: "logica",
    patterns: [/logic/i, /raciocínio/i, /raciocinio/i, /encade/i, /sequencia/i, /sequência/i],
  },
  {
    id: "abstracao",
    patterns: [/abstr/i, /generaliz/i, /conceitual/i, /teoric/i, /categor/i],
  },
  {
    id: "recuperacao_conceitual",
    patterns: [/recordar/i, /lembrar/i, /definir/i, /conceito/i, /teoria/i, /lei\b/i, /regra/i],
  },
  {
    id: "aplicacao",
    patterns: [/aplic/i, /situa/i, /contexto/i, /cotidiano/i, /pratic/i, /prática/i],
  },
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

export type ClusterCognitivo = {
  tipo: TipoCognitivoId;
  label: string;
  verboTreino: string;
  erros: number;
  errosPonderados: number;
  exemplosConhecimento: string[];
  materias: string[];
};

export function agruparPorTipoCognitivo(
  lacunas: Array<{
    texto: string;
    materia: string | null;
    erros: number;
    errosPonderados: number;
  }>
): ClusterCognitivo[] {
  const map = new Map<TipoCognitivoId, ClusterCognitivo>();

  for (const l of lacunas) {
    const tipo = inferirTipoCognitivo(l.texto);
    const c =
      map.get(tipo.id) ??
      ({
        tipo: tipo.id,
        label: tipo.label,
        verboTreino: tipo.verboTreino,
        erros: 0,
        errosPonderados: 0,
        exemplosConhecimento: [],
        materias: [],
      } satisfies ClusterCognitivo);

    c.erros += l.erros;
    c.errosPonderados += l.errosPonderados;
    if (c.exemplosConhecimento.length < 2) c.exemplosConhecimento.push(l.texto);
    if (l.materia && !c.materias.includes(l.materia)) c.materias.push(l.materia);

    map.set(tipo.id, c);
  }

  return [...map.values()].sort((a, b) => b.errosPonderados - a.errosPonderados);
}

/** Frase de gargalo cognitivo (não “Matemática 40%”). */
export function fraseGargaloCognitivo(cluster: ClusterCognitivo): string {
  const ctx =
    cluster.materias.length > 0
      ? ` — aparece sobretudo em ${cluster.materias.slice(0, 2).join(" e ")}`
      : "";
  return `Dificuldade em ${cluster.verboTreino}${ctx}.`;
}

/** Missão em linguagem cognitiva. */
export function tituloMissaoCognitiva(cluster: ClusterCognitivo): string {
  return `Treinar ${cluster.label.toLowerCase()} na prática`;
}
