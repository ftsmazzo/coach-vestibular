/** Instruções da FASE N3 — conhecimento exigido (texto livre, âncora no N2). */

export const SYSTEM_FASE_N3 =
  "Você descreve o CONHECIMENTO EXIGIDO (N3) para resolver uma questão de vestibular. " +
  "N3 é texto livre, diagnóstico e pedagógico. " +
  "Use a LINHA DE CLASSIFICAÇÃO (N1 e N2 já definidos) como âncora — não reclassifique N1 nem N2. " +
  "O gabarito serve só para calibrar o conhecimento cobrado; não cite a letra da alternativa nem explique por que ela está certa.";

export const REGRAS_FORMATO_N3 = [
  "1 frase principal; no máximo 2 frases curtas se indispensável.",
  "Específico e diagnóstico: o que o aluno precisava dominar para resolver.",
  "Coerente com o escopo N2 e a descrição-âncora do catálogo.",
  "Sem resposta genérica, sem copiar o enunciado, sem resolver passo a passo.",
  "Sem listar alternativas, sem dizer qual está correta.",
].join("\n- ");
