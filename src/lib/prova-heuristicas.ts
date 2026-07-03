import { taxonomy } from "@/lib/taxonomy";

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function assuntoPadraoMateria(materiaLabel: string): string {
  const mat = taxonomy.materias.find((m) => m.label === materiaLabel);
  return mat?.temas[0]?.label ?? "A classificar";
}

/** Heurística por palavras-chave no enunciado (pós-IA / revisão). */
export function inferirMateriaPorEnunciado(enunciado: string): string | null {
  const t = enunciado.trim();
  if (!t) return null;

  const n = norm(t);
  if (
    /escrevivencia|conceicao evaristo|literatura canonica|entrevista, a escritora|poesia|cordel|teatro|didascal/.test(
      n
    )
  ) {
    return "Português";
  }
  if (/tetraedro|matriz quadrada|funcao de variavel|y\s*=\s*f\s*\(|determinante|trigonometria/.test(n)) {
    return "Matemática";
  }
  if (
    /cinematica|eletricidade|optica|termodinamica|forca resultante|velocidade|aceleração|aceleracao|newton|joule|ohm|circuito|corrente eletrica|lente|refração|reflexao/.test(
      n
    )
  ) {
    return "Física";
  }
  if (/geografia humana|cartografia|urbanizacao|latitude|longitude|clima\b|relevo|hidrografia|metropolizacao/.test(n)) {
    return "Geografia";
  }
  if (
    /hotspot|biodiversidade|endemismo|citologia|genetica|dna\b|rna\b|mitose|meiose|fotossintese|homeostase/.test(
      n
    ) ||
    (/bioma|ecologia|fisiologia humana/.test(n) &&
      !/cinematica|forca resultante|circuito|optica|termodinamica/.test(n))
  ) {
    return "Biologia";
  }
  if (/estequiometria|equilibrio quimico|eletroquimica|atomistica/.test(n)) {
    return "Química";
  }
  if (/brasil republica|revolucao industrial|idade media|imperialismo/.test(n)) {
    return "História";
  }
  if (/sociologia|movimento[s]?\s+sociais|estrutura\s+social|desigualdade\s+social/.test(n)) {
    return "Sociologia";
  }
  if (/filosofia|etica|kant|platão|platao|aristoteles/.test(n)) {
    return "Filosofia";
  }
  if (/gramatica|regencia verbal|crase|sintaxe|morfologia|pontuacao/.test(n)) {
    return "Português";
  }
  return null;
}
