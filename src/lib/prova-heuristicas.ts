import {
  detectarPassagemIngles,
  detectarPassagemEspanhol,
} from "@/lib/prova-materia-ajuste";
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
  if (detectarPassagemIngles(t)) return "Inglês";
  if (detectarPassagemEspanhol(t)) return "Espanhol";

  const n = norm(t);
  if (
    /escrevivencia|conceicao evaristo|literatura canonica|entrevista, a escritora|poesia|cordel|teatro|didascal/.test(
      n
    )
  ) {
    return "Português";
  }
  if (/hotspot|biodiversidade|bioma|endemismo|ecologia|fisiologia humana|citologia|genetica/.test(n)) {
    return "Biologia";
  }
  if (/tetraedro|matriz quadrada|funcao de variavel|y\s*=\s*f\s*\(|determinante|trigonometria/.test(n)) {
    return "Matemática";
  }
  if (/cinematica|eletricidade|optica|termodinamica|forca resultante/.test(n)) {
    return "Física";
  }
  if (/estequiometria|equilibrio quimico|eletroquimica|atomistica/.test(n)) {
    return "Química";
  }
  if (/brasil republica|revolucao industrial|idade media|imperialismo/.test(n)) {
    return "História";
  }
  if (/geografia humana|clima|cartografia|urbanizacao/.test(n)) {
    return "Geografia";
  }
  if (/gramatica|regencia verbal|crase|sintaxe|morfologia|pontuacao/.test(n)) {
    return "Português";
  }
  if (
    /de acordo com o texto|segundo o texto|com base no texto|no fragmento|na entrevista/.test(n) &&
    !/hotspot|biodiversidade|tetraedro|matriz|funcao de variavel|cinematica|estequiometria/.test(n)
  ) {
    return "Português";
  }
  return null;
}
