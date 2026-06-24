import { extrairTrechosPorNumero } from "./prova-texto-parse";
import {
  detectarPassagemIngles,
  normalizarMateria,
  textoIndicaIngles,
  textoIndicaPortugues,
} from "./prova-materia-ajuste";
import {
  areaBlocoEhCanonica,
  inferirAreaBlocoPorMateria,
  normalizarAreaBloco,
} from "./areas-bloco";
import {
  materiaCompativelComBloco,
  temGatilhoBiologico,
  temGatilhoGeografico,
  validarItemClassificado,
} from "./prova-classificacao-regras";
import { inferirMateriaPorEnunciado } from "./prova-heuristicas";
import {
  assuntoPertenceMateria,
  encontrarMateriaDoAssunto,
} from "./taxonomia-validacao";
import { varianteInconsistenteComMateria, compararQuestoesPorNumeroEOrdem } from "./prova-idioma";

const MARCA_CONFERIDO = "[CONFERIDO]";

/** Revisor salvou a questão como conferida — não aplicar heurísticas “suspeitas”. */
export function questaoConferidaPeloRevisor(observacoes?: string | null): boolean {
  return observacoes?.includes(MARCA_CONFERIDO) ?? false;
}

export function marcarObservacoesConferidas(
  observacoes: string,
  conferida: boolean
): string {
  const semMarca = observacoes.replace(/\[CONFERIDO\]\s*/gi, "").trim();
  if (!conferida) return semMarca;
  return semMarca ? `${MARCA_CONFERIDO} ${semMarca}` : MARCA_CONFERIDO;
}

export interface QuestaoAuditoriaInput {
  numero: number;
  idiomaVariante?: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  areaBloco?: string | null;
  observacoes?: string | null;
  enunciado?: string | null;
}

export interface ClassificacaoResumo {
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  areaBloco?: string | null;
}

export interface AlertaAuditoria {
  numero: number;
  idiomaVariante?: string;
  severidade: "alta" | "media";
  motivos: string[];
  atual: ClassificacaoResumo;
  vizinhoAnterior?: { numero: number; classificacao: ClassificacaoResumo };
  vizinhoPosterior?: { numero: number; classificacao: ClassificacaoResumo };
  parRemoto?: { numero: number; classificacao: ClassificacaoResumo };
  enunciado?: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Chave estrita: matéria + assunto (detecta cópia errada da IA). */
function chave(q: Pick<QuestaoAuditoriaInput, "materia" | "assunto">): string {
  return `${norm(q.materia)}|${norm(q.assunto)}`;
}

/** Assunto que a IA costuma usar em questões de inglês classificadas errado como PT. */
function assuntoInterpretacaoGenerica(assunto: string): boolean {
  const a = norm(assunto);
  if (
    a.includes("literatura") ||
    a.includes("entrevista") ||
    a.includes("gramática") ||
    a.includes("gramatica") ||
    a.includes("inglês") ||
    a.includes("ingles") ||
    a.includes("espanhol")
  ) {
    return false;
  }
  return (
    a === "interpretação de texto" ||
    a === "interpretacao de texto" ||
    /^interpreta[cç][aã]o de texto\.?$/i.test(assunto.trim())
  );
}

const RE_CONHECIMENTO_PT =
  /gramática|gramatica|ortografia|coesão|coesao|poesia|crônica|cronica|gênero textual|genero textual|figuras de linguagem|variação linguística|variacao linguistica|sujeito|predicado|pontuação|pontuacao|linguagem formal|intertextualidade|denotação|denotacao|conotação|conotacao|morfologia|sintaxe|semântica|semantica|artigo de opinião|artigo de opiniao/i;

function conhecimentoParecePortuguesNativo(q: QuestaoAuditoriaInput): boolean {
  const c = q.conhecimentoExigido ?? "";
  return RE_CONHECIMENTO_PT.test(c) || RE_CONHECIMENTO_PT.test(q.assunto);
}

/** Regras em TODA questão — não depende de vizinho ou proximidade. */
function motivosRegrasEstruturais(
  q: QuestaoAuditoriaInput,
  textoQ: string,
  conferida: boolean
): string[] {
  const out: string[] = [];
  const mat = q.materia.trim();
  const assunto = q.assunto.trim();
  const blob = [textoQ, q.assunto, q.conhecimentoExigido ?? "", q.observacoes ?? ""]
    .filter(Boolean)
    .join("\n");

  if (mat === "A classificar" || assunto === "A classificar") {
    out.push("Classificação incompleta (A classificar).");
  }

  if (q.areaBloco?.trim() && !areaBlocoEhCanonica(q.areaBloco)) {
    const sugerida = normalizarAreaBloco(q.areaBloco, mat) ?? inferirAreaBlocoPorMateria(mat);
    out.push(
      sugerida
        ? `Área «${q.areaBloco.slice(0, 40)}» não é padrão interno — use «${sugerida}».`
        : `Área «${q.areaBloco.slice(0, 40)}» não é padrão interno (Línguas e códigos, Humanas, Naturais ou Exatas).`
    );
  }

  if (q.areaBloco?.trim() && mat && mat !== "A classificar") {
    if (!materiaCompativelComBloco(q.areaBloco, mat)) {
      out.push(
        `Bloco/área «${q.areaBloco.slice(0, 50)}» incompatível com matéria «${mat}» (ex.: Humanas ≠ Biologia, Linguagens ≠ Geografia).`
      );
    }
    const val = validarItemClassificado({
      numero: q.numero,
      areaBloco: q.areaBloco,
      materia: mat,
      assunto,
      conhecimento: q.conhecimentoExigido ?? undefined,
      resumoEnunciado: blob.slice(0, 400),
    });
    if (!val.ok && val.motivo) {
      out.push(val.motivo);
    }
  }

  if (!conferida) {
    if (mat === "Biologia" && blob.length > 20 && !temGatilhoBiologico(blob)) {
      out.push(
        "Biologia sem gatilho biológico claro (célula, DNA, ecologia, fisiologia, etc.) no texto salvo."
      );
    }

    if (
      mat === "Geografia" &&
      normalizarAreaBloco(q.areaBloco, mat) === "Línguas e códigos" &&
      !temGatilhoGeografico(blob)
    ) {
      out.push("Geografia em bloco de Línguas e códigos sem conteúdo cartográfico/espacial explícito.");
    }

    if (
      mat === "Física" &&
      /bioma|ecologia|biodiversidade|hotspot/i.test(blob) &&
      !/força|circuito|cinemática|cinematica|velocidade|newton|joule|optica|óptica/i.test(blob)
    ) {
      out.push("Possível confusão: parece conteúdo de Biologia/Geo, não Física.");
    }
  }

  return out;
}

/** Quando há texto suficiente, compara com palavras-chave (não depende de vizinho). */
function motivosConflitoConteudo(
  q: QuestaoAuditoriaInput,
  textoQ: string
): string[] {
  if (textoQ.trim().length < 100) return [];
  const inferida = inferirMateriaPorEnunciado(textoQ);
  if (!inferida) return [];
  const ni = norm(inferida);
  const na = norm(q.materia);
  if (ni === na || q.materia === "A classificar") return [];
  const humanas = new Set(["historia", "geografia", "filosofia", "sociologia"]);
  if (humanas.has(ni) && humanas.has(na)) return [];
  const natureza = new Set(["biologia", "fisica", "quimica", "natureza_transversal"]);
  if (natureza.has(ni) && natureza.has(na)) return [];
  // Comando em português é normal em Humanas/Filosofia/etc. — não alertar “parece Português”.
  if (ni === "portugues" && (humanas.has(na) || na === "filosofia" || na === "sociologia")) {
    return [];
  }
  return [
    `Conteúdo do texto sugere «${inferida}», mas está gravado como «${q.materia}» — edite na tabela ou reclassifique.`,
  ];
}

function motivosRevisaoIdioma(
  q: QuestaoAuditoriaInput,
  qMat: string,
  textoQ: string
): string[] {
  const out: string[] = [];
  const blob = [textoQ, q.assunto, q.conhecimentoExigido ?? ""].filter(Boolean).join("\n");

  if (qMat === "portugues") {
    if (textoIndicaPortugues(blob)) {
      return out;
    }
    if (textoIndicaIngles(blob) || detectarPassagemIngles(blob)) {
      out.push(
        "Texto-base em inglês, mas matéria no banco é Português — cole o enunciado abaixo e clique em Reclassificar."
      );
    } else if (
      assuntoInterpretacaoGenerica(q.assunto) &&
      q.numero >= 15 &&
      q.numero <= 35 &&
      !conhecimentoParecePortuguesNativo(q)
    ) {
      out.push(
        "Marcada como Português com assunto genérico na faixa em que a prova costuma ter inglês (ex.: 16, 19). Cole o enunciado e reclassifique se o texto-base for em inglês."
      );
    }
  }

  if (qMat === "espanhol" && textoIndicaPortugues(blob)) {
    out.push(
      "Texto-base em português, mas matéria no banco é Espanhol — cole o enunciado e reclassifique."
    );
  }

  return out;
}

function resumo(q: QuestaoAuditoriaInput): ClassificacaoResumo {
  return {
    materia: q.materia,
    assunto: q.assunto,
    conhecimentoExigido: q.conhecimentoExigido,
    nivelDificuldade: q.nivelDificuldade,
    areaBloco: q.areaBloco,
  };
}

export function auditarClassificacaoQuestoes(
  questoes: QuestaoAuditoriaInput[],
  textoFonte?: string | null,
  ordemIdiomasFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO" | null
): AlertaAuditoria[] {
  const sorted = [...questoes].sort((a, b) =>
    compararQuestoesPorNumeroEOrdem(a, b, ordemIdiomasFaixa)
  );
  const alertas: AlertaAuditoria[] = [];

  let trechos = new Map<number, string>();
  if (textoFonte?.trim()) {
    trechos = extrairTrechosPorNumero(textoFonte);
  }

  for (let i = 0; i < sorted.length; i++) {
    const q = sorted[i];
    const motivos: string[] = [];
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const qKey = chave(q);
    const qMat = normalizarMateria(q.materia);

    if (q.materia === "A classificar" || q.assunto === "A classificar") {
      motivos.push("Matéria ou assunto ainda «A classificar».");
    }

    if (
      q.materia !== "A classificar" &&
      q.assunto !== "A classificar" &&
      !assuntoPertenceMateria(q.materia, q.assunto)
    ) {
      const dono = encontrarMateriaDoAssunto(q.assunto);
      if (dono && dono.materia !== q.materia) {
        motivos.push(
          `Assunto «${q.assunto}» é de ${dono.materia}, mas a questão está como ${q.materia}.`
        );
      } else {
        motivos.push(
          `Assunto «${q.assunto}» não pertence à taxonomia de ${q.materia}.`
        );
      }
    }

    const textoQ =
      q.enunciado?.trim() || trechos.get(q.numero) || "";

    const conferida = questaoConferidaPeloRevisor(q.observacoes);

    for (const m of motivosRegrasEstruturais(q, textoQ, conferida)) {
      if (!motivos.includes(m)) motivos.push(m);
    }

    if (
      q.idiomaVariante &&
      q.idiomaVariante !== "COMUM" &&
      varianteInconsistenteComMateria(q.materia, q.idiomaVariante)
    ) {
      motivos.push(
        `Matéria «${q.materia}» não corresponde à trilha ${q.idiomaVariante === "INGLES" ? "Inglês" : "Espanhol"} — troque a matéria ou use Editar para alinhar conteúdo e gabarito.`
      );
    }

    if (!conferida) {
      for (const m of motivosRevisaoIdioma(q, qMat, textoQ)) {
        if (!motivos.includes(m)) motivos.push(m);
      }

      for (const m of motivosConflitoConteudo(q, textoQ)) {
        if (!motivos.includes(m)) motivos.push(m);
      }
    }

    if (!conferida && prev && next) {
      const pk = chave(prev);
      const nk = chave(next);
      const prevMat = normalizarMateria(prev.materia);
      const nextMat = normalizarMateria(next.materia);

      if (pk === nk && qKey !== pk) {
        const mesmaDisciplina =
          prevMat === qMat && nextMat === qMat && prevMat === nextMat;
        if (!mesmaDisciplina) {
          motivos.push(
            `Questões ${prev.numero} e ${next.numero} têm a mesma classificação (${prev.materia} — ${prev.assunto}), mas esta difere — comum após quebra de página na IA.`
          );
        }
      }
    }

    let parRemoto: AlertaAuditoria["parRemoto"];
    if (!conferida) {
      for (const other of sorted) {
        if (other.numero === q.numero) continue;
        const dist = Math.abs(other.numero - q.numero);
        if (dist < 5 || dist > 15) continue;
        if (chave(other) !== qKey) continue;
        if (prev && chave(prev) === qKey) continue;
        if (next && chave(next) === qKey) continue;
        const prevMat = prev ? normalizarMateria(prev.materia) : "";
        const nextMat = next ? normalizarMateria(next.materia) : "";
        if (prevMat === qMat || nextMat === qMat) continue;
        parRemoto = { numero: other.numero, classificacao: resumo(other) };
        motivos.push(
          `Classificação idêntica à questão ${other.numero}, mas vizinhos ${prev?.numero ?? "—"} e ${next?.numero ?? "—"} são de outra matéria — possível erro de quebra de página.`
        );
        break;
      }
    }

    if (motivos.length === 0) continue;

    const enunciado =
      q.enunciado?.trim() ||
      trechos.get(q.numero) ||
      undefined;

    alertas.push({
      numero: q.numero,
      idiomaVariante: q.idiomaVariante && q.idiomaVariante !== "COMUM" ? q.idiomaVariante : undefined,
      severidade:
        motivos.some(
          (m) =>
            m.includes("quebra") ||
            m.includes("possível erro") ||
            m.includes("incompatível") ||
            m.includes("Biologia") ||
            m.includes("INCONSISTÊNCIA")
        )
          ? "alta"
          : "media",
      motivos,
      atual: resumo(q),
      vizinhoAnterior: prev
        ? { numero: prev.numero, classificacao: resumo(prev) }
        : undefined,
      vizinhoPosterior: next
        ? { numero: next.numero, classificacao: resumo(next) }
        : undefined,
      parRemoto,
      enunciado,
    });
  }

  return alertas.sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === "alta" ? -1 : 1;
    return a.numero - b.numero;
  });
}

function escCsv(val: string): string {
  const v = val.replace(/"/g, '""').replace(/\r?\n/g, " ");
  return v.includes(",") || v.includes('"') ? `"${v}"` : v;
}

export function formatarExportacaoAuditoria(
  provaNome: string,
  alertas: AlertaAuditoria[]
): { texto: string; csv: string; numeros: number[] } {
  const linhas: string[] = [
    `=== AUDITORIA — ${provaNome} ===`,
    `${alertas.length} questão(ões) suspeita(s).`,
    "",
  ];

  for (const a of alertas) {
    linhas.push(`--- Questão ${a.numero} [${a.severidade.toUpperCase()}] ---`);
    for (const mot of a.motivos) linhas.push(`• ${mot}`);
    linhas.push("");
    linhas.push(`  materia: ${a.atual.materia}`);
    linhas.push(`  assunto: ${a.atual.assunto}`);
    linhas.push("");
  }

  const header =
    "numero,materia,assunto,conhecimentoExigido,nivelDificuldade,enunciado,motivo_auditoria";
  const csvRows = alertas.map((a) => {
    const mot = a.motivos.join(" | ");
    const enun = (a.enunciado ?? "").slice(0, 500);
    return [
      a.numero,
      escCsv(a.atual.materia),
      escCsv(a.atual.assunto),
      escCsv(a.atual.conhecimentoExigido ?? ""),
      escCsv(a.atual.nivelDificuldade ?? ""),
      escCsv(enun),
      escCsv(mot),
    ].join(",");
  });

  return {
    texto: linhas.join("\n"),
    csv: [header, ...csvRows].join("\n"),
    numeros: alertas.map((a) => a.numero),
  };
}
