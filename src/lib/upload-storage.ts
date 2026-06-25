import fs from "fs/promises";
import path from "path";

const SUBDIR_SOLICITACOES = "solicitacoes";
const SUBDIR_PROVAS = "provas";
const SUBDIR_FEEDBACK = "feedback";

export function getUploadRoot(): string {
  const root = process.env.UPLOAD_STORAGE_DIR?.trim();
  if (root) return path.resolve(root);
  return path.join(process.cwd(), "data", "uploads");
}

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "arquivo";
}

/** Salva PDF/foto da solicitação; retorna caminho relativo para o banco. */
export async function saveSolicitacaoFile(jobId: string, file: File): Promise<string> {
  const safeName = sanitizeFileName(file.name);
  const rel = path.posix.join(SUBDIR_SOLICITACOES, jobId, safeName);
  const abs = path.join(getUploadRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(abs, buf);
  return rel;
}

/** Salva o gabarito oficial num subdiretório próprio (evita colisão com a prova). */
export async function saveSolicitacaoGabarito(jobId: string, file: File): Promise<string> {
  const safeName = sanitizeFileName(file.name);
  const rel = path.posix.join(SUBDIR_SOLICITACOES, jobId, "gabarito", safeName);
  const abs = path.join(getUploadRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(abs, buf);
  return rel;
}

/** Salva o caderno (PDF/imagem) de uma prova para download do aluno. */
export async function saveProvaCaderno(provaId: string, file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveProvaCadernoBuffer(provaId, buf, file.name, file.type);
  return storagePath;
}

/** Salva caderno a partir de buffer (pipeline de extração). */
export async function saveProvaCadernoBuffer(
  provaId: string,
  buffer: Buffer,
  fileName: string,
  mimeType = "application/pdf"
): Promise<{ storagePath: string; fileName: string; mimeType: string }> {
  const safeName = sanitizeFileName(fileName);
  const rel = path.posix.join(SUBDIR_PROVAS, provaId, "caderno", safeName);
  const abs = path.join(getUploadRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return { storagePath: rel, fileName: safeName, mimeType: mimeType || "application/pdf" };
}

/** Salva o anexo (print) de um report de erro. */
export async function saveFeedbackAnexo(feedbackId: string, file: File): Promise<string> {
  const safeName = sanitizeFileName(file.name);
  const rel = path.posix.join(SUBDIR_FEEDBACK, feedbackId, safeName);
  const abs = path.join(getUploadRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(abs, buf);
  return rel;
}

export function resolveStoredFilePath(storagePath: string): string {
  const root = getUploadRoot();
  const normalized = storagePath.replace(/\\/g, "/");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Caminho de arquivo inválido");
  }
  const abs = path.resolve(root, normalized);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Caminho de arquivo inválido");
  }
  return abs;
}

export async function readStoredFile(
  storagePath: string
): Promise<{ buffer: Buffer; absolutePath: string }> {
  const abs = resolveStoredFilePath(storagePath);
  const buffer = await fs.readFile(abs);
  return { buffer, absolutePath: abs };
}

export async function storedFileExists(storagePath: string): Promise<boolean> {
  try {
    const abs = resolveStoredFilePath(storagePath);
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}
