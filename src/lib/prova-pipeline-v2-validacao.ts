import {
  minimoQuestoesEstrutura,
  type EstruturaProvaDetectada,
} from "@/lib/prova-pipeline-contexto";

export type { EstruturaProvaDetectada };

export type ClassificacaoLoteRes = {
  questoes?: Array<{
    numero: number;
    area_bloco?: string;
    materia?: string;
    assunto?: string;
    conhecimento?: string;
    dificuldade?: string;
  }>;
};

function ratioMinimo(): number {
  const r = parseFloat(process.env.PIPELINE_V2_MIN_COVERAGE ?? "0.55");
  return Number.isFinite(r) && r > 0 && r <= 1 ? r : 0.55;
}

export function validarEstruturaProva(
  data: EstruturaProvaDetectada,
  totalEsperado: number
): void {
  if (!data || !Array.isArray(data.numeros)) {
    throw new Error("Resposta estrutural sem lista de números");
  }

  const nums = [...new Set(data.numeros.filter((n) => Number.isInteger(n) && n > 0 && n <= 500))];
  const minimoCadastro = minimoQuestoesEstrutura(totalEsperado);
  const detectado = data.total_questoes_detectado;
  const minimoDetectado =
    typeof detectado === "number" && detectado > 0
      ? Math.max(3, Math.ceil(detectado * ratioMinimo()))
      : minimoCadastro;

  const minimo = Math.min(minimoCadastro, minimoDetectado);

  if (nums.length < minimo) {
    throw new Error(
      `Poucos números no PDF (${nums.length}; mínimo ~${minimo} para cadastro de ${totalEsperado})`
    );
  }

  if (data.numeros.length > nums.length + 5) {
    throw new Error(
      `Muitas numerações duplicadas ou inválidas (${data.numeros.length} → ${nums.length} únicos)`
    );
  }
}

export function validarClassificacaoLote(
  data: ClassificacaoLoteRes,
  numerosEsperados: number[]
): void {
  if (!data?.questoes || !Array.isArray(data.questoes)) {
    throw new Error("Classificação sem array de questões");
  }

  const esperados = new Set(numerosEsperados);
  const noLote = data.questoes.filter((q) => esperados.has(q.numero));
  const minimo = Math.max(1, Math.ceil(numerosEsperados.length * ratioMinimo()));

  if (noLote.length < minimo) {
    throw new Error(
      `Lote incompleto: ${noLote.length}/${numerosEsperados.length} questões (mínimo ${minimo})`
    );
  }

  let semPedagogia = 0;
  for (const q of noLote) {
    const d = (q.dificuldade ?? "").trim().toLowerCase();
    if (d && !["facil", "media", "dificil", "fácil", "média", "difícil"].includes(d)) {
      throw new Error(`Dificuldade inválida na questão ${q.numero}`);
    }
    const materiaVazia = !q.materia?.trim() || q.materia.trim() === "A classificar";
    const conhecimentoVazio = !q.conhecimento?.trim();
    if (materiaVazia && conhecimentoVazio) semPedagogia++;
  }

  const maxSemPedagogia = Math.ceil(noLote.length * 0.5);
  if (semPedagogia > maxSemPedagogia) {
    throw new Error(
      `Muitas questões sem matéria/conhecimento útil (${semPedagogia}/${noLote.length})`
    );
  }
}
