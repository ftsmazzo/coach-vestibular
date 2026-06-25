import type { IdiomaVarianteQuestao } from "@/lib/prova-idioma";
import {
  ENUNCIADO_VALIDACAO_MIN_CHARS,
  extracaoAceitaPorObservacao,
  sanitizarTextoProva,
  statusEnunciadoExtracao,
  type StatusExtracaoQuestao,
} from "@/lib/prova-texto-prova";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";

export type LinhaExtracaoRelatorio = {
  chave: string;
  questaoId?: string;
  ordemExtracao: number;
  numero: number;
  enunciado?: string | null;
  alternativas?: string | null;
  tamanhoEnunciado: number;
  tamanhoAlternativas: number;
  status: StatusExtracaoQuestao;
  aceitoManualmente?: boolean;
};

export type RelatorioExtracaoProva = {
  /** Total lógico cadastrado na prova (como o aluno responde) */
  totalLogicoCadastro: number;
  /** Linhas físicas extraídas / esperadas na validação */
  linhasFisicas: number;
  ok: number;
  curto: number;
  faltando: number;
  prontaParaValidar: boolean;
  linhas: LinhaExtracaoRelatorio[];
};

type QuestaoDb = {
  id: string;
  ordemExtracao: number;
  numero: number;
  enunciado?: string | null;
  alternativas?: string | null;
  observacoes?: string | null;
};

export function montarRelatorioExtracao(
  questoes: QuestaoDb[],
  totalLogicoCadastro: number
): RelatorioExtracaoProva {
  const ordenadas = [...questoes].sort(compararPorOrdemExtracao);
  const maxOrdem = ordenadas.reduce((m, q) => Math.max(m, q.ordemExtracao), 0);
  const porOrdem = new Map(ordenadas.map((q) => [q.ordemExtracao, q]));

  const linhas: LinhaExtracaoRelatorio[] = [];
  for (let ordem = 1; ordem <= maxOrdem; ordem++) {
    const q = porOrdem.get(ordem);
    const en = sanitizarTextoProva(q?.enunciado);
    const alt = sanitizarTextoProva(q?.alternativas);
    const aceitoManual = extracaoAceitaPorObservacao(q?.observacoes);
    const status = q
      ? statusEnunciadoExtracao(en, ENUNCIADO_VALIDACAO_MIN_CHARS, { aceitoManual })
      : "faltando";
    linhas.push({
      chave: String(ordem),
      questaoId: q?.id,
      ordemExtracao: ordem,
      numero: q?.numero ?? 0,
      enunciado: en || null,
      alternativas: alt || null,
      tamanhoEnunciado: en.length,
      tamanhoAlternativas: alt.length,
      status,
      aceitoManualmente: aceitoManual && status === "ok",
    });
  }

  const ok = linhas.filter((l) => l.status === "ok").length;
  const curto = linhas.filter((l) => l.status === "curto").length;
  const faltando = linhas.filter((l) => l.status === "faltando").length;

  return {
    totalLogicoCadastro,
    linhasFisicas: linhas.length,
    ok,
    curto,
    faltando,
    prontaParaValidar: faltando === 0 && curto === 0 && linhas.length > 0,
    linhas,
  };
}

export function resumoExtracao(relatorio: RelatorioExtracaoProva): string {
  return `${relatorio.ok}/${relatorio.linhasFisicas} OK · ${relatorio.curto} curto(s) · ${relatorio.faltando} faltando · ${relatorio.linhasFisicas} linha(s) física(s) · cadastro ${relatorio.totalLogicoCadastro} lógica(s)`;
}
