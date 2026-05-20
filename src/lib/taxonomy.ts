import taxonomyData from "../../data/taxonomy.json";

export type TipoErroId = "base_teorica" | "interpretacao" | "atencao" | "tempo";

export interface Tema {
  id: string;
  label: string;
}

export interface Materia {
  id: string;
  label: string;
  temas: Tema[];
}

export const taxonomy = taxonomyData as {
  version: string;
  focusAreas: Array<{
    id: string;
    label: string;
    materiaId: string;
    priority: string;
    note: string;
  }>;
  materias: Materia[];
  tiposErro: Array<{ id: TipoErroId; label: string; icone: string }>;
};

export function getMateria(id: string) {
  return taxonomy.materias.find((m) => m.id === id);
}

export function getTema(materiaId: string, temaId: string) {
  const materia = getMateria(materiaId);
  return materia?.temas.find((t) => t.id === temaId);
}

export function getTemaLabel(materiaId?: string | null, temaId?: string | null) {
  if (!materiaId || !temaId) return "Não classificado";
  return getTema(materiaId, temaId)?.label ?? temaId;
}

export function getMateriaLabel(materiaId?: string | null) {
  if (!materiaId) return "Geral";
  return getMateria(materiaId)?.label ?? materiaId;
}

export function getTipoErroLabel(id?: string | null) {
  if (!id) return null;
  return taxonomy.tiposErro.find((t) => t.id === id)?.label ?? id;
}

export function allTemasFlat() {
  return taxonomy.materias.flatMap((m) =>
    m.temas.map((t) => ({ materiaId: m.id, materiaLabel: m.label, temaId: t.id, temaLabel: t.label }))
  );
}
