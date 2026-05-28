/**
 * Cliente mínimo para OpenAI Responses API + upload de arquivos.
 * @see https://developers.openai.com/api/docs/guides/pdf-files
 */

export type JsonSchemaFormat = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY não configurada no servidor");
  return key;
}

import {
  modeloPipelineFallback,
  modeloPipelinePrincipal,
} from "@/lib/openai-modelos";

export { modeloPipelinePrincipal, modeloPipelineFallback };

/** Envia arquivo ao Files API (purpose user_data) — PDF ou imagem. */
export async function uploadFileBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const apiKey = getApiKey();
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    filename
  );

  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI Files: ${res.status} ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("OpenAI Files: resposta sem file id");
  return data.id;
}

/** Envia PDF ao Files API (purpose user_data). */
export async function uploadPdfBuffer(
  buffer: Buffer,
  filename = "prova.pdf"
): Promise<string> {
  return uploadFileBuffer(buffer, filename, "application/pdf");
}

function extrairTextoOutput(data: Record<string, unknown>): string {
  const direct = data.output_text;
  if (typeof direct === "string" && direct.trim()) return direct;

  const output = data.output;
  if (!Array.isArray(output)) {
    throw new Error("Resposta OpenAI sem output utilizável");
  }

  const partes: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type === "message" && Array.isArray(o.content)) {
      for (const c of o.content) {
        if (
          c &&
          typeof c === "object" &&
          (c as Record<string, unknown>).type === "output_text" &&
          typeof (c as Record<string, unknown>).text === "string"
        ) {
          partes.push((c as Record<string, unknown>).text as string);
        }
      }
    }
  }

  const joined = partes.join("").trim();
  if (!joined) throw new Error("Resposta OpenAI vazia");
  return joined;
}

/** Chamada Responses API com PDF (file_id) e JSON Schema rígido. */
export async function responsesComPdfSchema<T>(opts: {
  fileId: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  model?: string;
}): Promise<T> {
  const apiKey = getApiKey();
  const model = opts.model ?? modeloPipelinePrincipal();

  const input: Array<{
    role: string;
    content: Array<{ type: string; text?: string; file_id?: string }>;
  }> = [];

  if (opts.systemPrompt?.trim()) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: opts.systemPrompt.trim() }],
    });
  }

  input.push({
    role: "user",
    content: [
      { type: "input_text", text: opts.instrucao },
      { type: "input_file", file_id: opts.fileId },
    ],
  });

  const body = {
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name: opts.schema.name,
        strict: opts.schema.strict ?? true,
        schema: opts.schema.schema,
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI Responses (${model}): ${res.status} ${err.slice(0, 400)}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const raw = extrairTextoOutput(data);
  return JSON.parse(raw) as T;
}

export type ResponsesPdfOpts<T> = {
  fileId: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  taskName: string;
  validate: (data: T) => void;
};

/** Primary → validação → retry → fallback (só se qualidade ou API falhar). */
export async function responsesComPdfSchemaComValidacao<T>(
  opts: ResponsesPdfOpts<T>
): Promise<{ data: T; model: string; tier: "primary" | "fallback"; attempt: number }> {
  const { executarComFallback } = await import("@/lib/executar-com-fallback");

  const exec = await executarComFallback<T>({
    taskName: opts.taskName,
    run: (model) =>
      responsesComPdfSchema<T>({
        fileId: opts.fileId,
        instrucao: opts.instrucao,
        systemPrompt: opts.systemPrompt,
        schema: opts.schema,
        model,
      }),
    validate: opts.validate,
  });

  return {
    data: exec.resultado,
    model: exec.model,
    tier: exec.tier,
    attempt: exec.attempt,
  };
}

/** @deprecated Use responsesComPdfSchemaComValidacao com validate. */
export async function responsesComPdfSchemaComFallback<T>(opts: {
  fileId: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  taskName?: string;
}): Promise<{ data: T; model: string }> {
  const r = await responsesComPdfSchemaComValidacao<T>({
    ...opts,
    taskName: opts.taskName ?? "openai",
    validate: () => {},
  });
  return { data: r.data, model: r.model };
}
