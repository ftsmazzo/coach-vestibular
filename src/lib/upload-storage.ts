import fs from "fs/promises";
import path from "path";

const SUBDIR_SOLICITACOES = "solicitacoes";

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
