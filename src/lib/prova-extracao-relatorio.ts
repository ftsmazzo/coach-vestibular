import {
  ENUNCIADO_VALIDACAO_MIN_CHARS,
  extracaoAceitaPorObservacao,
  sanitizarTextoProva,
  statusEnunciadoExtracao,
  type StatusExtracaoQuestao,
} from "@/lib/prova-texto-prova";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";
import { numerosLogicosRevisaoImagem } from "@/lib/prova-revisao-imagem";
import { ocorrenciasMinimasCadastro } from "@/lib/prova-pipeline-ordem-numero";
import { statsQuestoesProva, type StatsQuestoesMeta } from "@/lib/prova-stats";

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
  linhasFisicasEsperadas: number | null;
  ok: number;
  curto: number;
  faltando: number;
  coberturaFaltando: number;
  textoIncompleto: number;
  prontaParaValidar: boolean;
  bloqueiosValidacao: string[];
  linhas: LinhaExtracaoRelatorio[];
};

type QuestaoDb = {
  id: string;
  ordemExtracao: number;
  numero: number;
  enunciado?: string | null;
  alternativas?: string | null;
  observacoes?: string | null;
  idiomaVariante?: string | null;
};

export type OpcoesRelatorioExtracao = {
  meta?: StatsQuestoesMeta;
  questoesFaltando?: number[];
  revisaoImagem?: number[];
};

export function montarRelatorioExtracaoComCobertura(
  questoes: QuestaoDb[],
  prova: StatsQuestoesMeta & { totalQuestoes: number }
): RelatorioExtracaoProva {
  const stats = statsQuestoesProva(questoes, prova.totalQuestoes, prova);
  const revisao = numerosLogicosRevisaoImagem(questoes);
  return montarRelatorioExtracao(questoes, prova.totalQuestoes, {
    meta: prova,
    questoesFaltando: stats.faltando,
    revisaoImagem: revisao,
  });
}

export function montarRelatorioExtracao(
  questoes: QuestaoDb[],
  totalLogicoCadastro: number,
  opts?: OpcoesRelatorioExtracao
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

  const coberturaNums = opts?.questoesFaltando ?? [];
  const textoIncompletoNums =
    opts?.revisaoImagem ?? numerosLogicosRevisaoImagem(questoes);

  const linhasFisicasEsperadas = opts?.meta
    ? ocorrenciasMinimasCadastro({
        totalEsperado: totalLogicoCadastro,
        politicaIdiomas: opts.meta.politicaIdiomas,
        idiomaQuestaoInicio: opts.meta.idiomaQuestaoInicio,
        idiomaQuestaoFim: opts.meta.idiomaQuestaoFim,
      })
    : null;

  const bloqueiosValidacao: string[] = [];
  if (faltando > 0) {
    bloqueiosValidacao.push(`${faltando} linha(s) física(s) sem enunciado`);
  }
  if (curto > 0) {
    bloqueiosValidacao.push(`${curto} enunciado(s) curto(s)`);
  }
  if (coberturaNums.length > 0) {
    bloqueiosValidacao.push(`${coberturaNums.length} questão(ões) lógica(s) ausente(s) no banco`);
  }
  if (textoIncompletoNums.length > 0) {
    bloqueiosValidacao.push(
      `${textoIncompletoNums.length} questão(ões) com alternativas incompletas (texto incompleto)`
    );
  }
  if (
    linhasFisicasEsperadas != null &&
    linhas.length > 0 &&
    linhas.length !== linhasFisicasEsperadas
  ) {
    bloqueiosValidacao.push(
      `${linhas.length} linha(s) física(s) no banco, esperado ${linhasFisicasEsperadas} para esta prova`
    );
  }

  const prontaParaValidar =
    bloqueiosValidacao.length === 0 && linhas.length > 0;

  return {
    totalLogicoCadastro,
    linhasFisicas: linhas.length,
    linhasFisicasEsperadas,
    ok,
    curto,
    faltando,
    coberturaFaltando: coberturaNums.length,
    textoIncompleto: textoIncompletoNums.length,
    prontaParaValidar,
    bloqueiosValidacao,
    linhas,
  };
}

export function resumoExtracao(relatorio: RelatorioExtracaoProva): string {
  const partes = [
    `${relatorio.ok}/${relatorio.linhasFisicas} OK`,
    relatorio.curto > 0 ? `${relatorio.curto} curto(s)` : null,
    relatorio.faltando > 0 ? `${relatorio.faltando} faltando` : null,
    relatorio.coberturaFaltando > 0 ? `${relatorio.coberturaFaltando} lógica(s) ausente(s)` : null,
    relatorio.textoIncompleto > 0 ? `${relatorio.textoIncompleto} texto incompleto` : null,
    `${relatorio.linhasFisicas} linha(s) física(s)`,
    `cadastro ${relatorio.totalLogicoCadastro} lógica(s)`,
  ].filter(Boolean);
  return partes.join(" · ");
}
