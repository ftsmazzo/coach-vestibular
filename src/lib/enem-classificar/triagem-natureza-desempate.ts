/** Desempates prioritários Bio × Quím × Fís — pelo conhecimento cobrado, não pelo tema do texto. */

import type { MateriaNatureza, TriagemNatureza } from "@/lib/enem-classificar/triagem-natureza";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

type RegraDesempate = {
  materia: MateriaNatureza;
  id: string;
  quando: RegExp;
};

const REGRAS_PRIORIDADE: RegraDesempate[] = [
  {
    id: "bio_fisiologia_ecologia",
    materia: "Biologia",
    quando:
      /\b(sucessao\s+ecologica|perturbac(o|ao)es?\s+ambientais|apos\s+a\s+perturbacao|recuperacao\s+ecologica|comunidade\s+(pioneira|climax|biologica))\b/,
  },
  {
    id: "bio_neuro_respiratorio",
    materia: "Biologia",
    quando:
      /\b(nicotina|neurotransmissor|dependencia\s+quimica|vape|cigarro\s+eletronico|enfisema\s+pulmonar|alveolos?\s+pulmonares|destruicao\s+das?\s+paredes?\s+dos?\s+alveolos)\b/,
  },
  {
    id: "quim_separacao_misturas",
    materia: "Química",
    quando:
      /\b(decantacao|destilacao|separacao\s+de\s+misturas|funil\s+de\s+separacao|liquidos?\s+imisciveis|arraste\s+de\s+vapor|oleo\s+essencial|metodo\s+de\s+separacao|etapa\s+final\s+de\s+separacao)\b/,
  },
  {
    id: "fis_colisoes_qdm",
    materia: "Física",
    quando:
      /\b(colis(ao|oes)\s+(frontais?|sucessivas?)|conservacao\s+da\s+quantidade\s+de\s+movimento|quantidade\s+de\s+movimento|momento\s+linear|velocidade\s+apos\s+a\s+colisao|sem\s+atrito)\b/,
  },
];

/** Termos ambientais territoriais — não triar como Química no bloco Natureza. */
const NAO_E_QUIMICA_AMBIENTAL =
  /\b(eutrofizacao|esgoto\s+in\s+natura|tratamento\s+de\s+esgoto|saneamento\s+ambiental|qualidade\s+da\s+agua|poluicao\s+hidrica|proliferacao\s+de\s+algas)\b/;

export function desempateTriagemNatureza(texto: string): TriagemNatureza | null {
  const t = norm(texto);
  if (t.length < 15) return null;

  for (const regra of REGRAS_PRIORIDADE) {
    if (regra.quando.test(t)) {
      return {
        materia: regra.materia,
        confianca: 0.88,
        motivo: `desempate:${regra.id}`,
      };
    }
  }

  if (NAO_E_QUIMICA_AMBIENTAL.test(t) && !/\b(ph\b|mol\b|molar|estequiometria|reacao\s+quimica)\b/.test(t)) {
    return null;
  }

  return null;
}
