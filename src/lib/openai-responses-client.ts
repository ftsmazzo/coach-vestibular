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

type InputContentItem =
  | { type: "input_text"; text: string }
  | { type: "input_file"; file_id: string }
  | { type: "input_image"; image_url: string };

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retriesResponses(): number {
  const n = parseInt(
    process.env.OPENAI_RESPONSES_RETRIES ??
      process.env.PIPELINE_V2_RETRIES_PRIMARY ??
      "3",
    10
  );
  return Number.isFinite(n) && n >= 1 ? n : 3;
}

const HTTP_RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function erroOpenAIResponses(model: string, status: number, body: string): Error {
  return new Error(`OpenAI Responses (${model}): ${status} ${body.slice(0, 400)}`);
}

/** POST /v1/responses com retry + backoff em falhas transitórias (429/5xx). */
async function postOpenAIResponses(
  body: Record<string, unknown>,
  model: string
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  const maxAttempts = retriesResponses();
  let lastErr = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }

    lastErr = await res.text();
    const retryable = HTTP_RETRYABLE.has(res.status);
    if (!retryable || attempt >= maxAttempts) {
      throw erroOpenAIResponses(model, res.status, lastErr);
    }

    const delayMs = Math.min(12_000, 800 * 2 ** (attempt - 1)) + Math.random() * 400;
    console.warn(
      `[openai:responses] ${model} HTTP ${res.status} — retry ${attempt}/${maxAttempts} em ${Math.round(delayMs)}ms`
    );
    await sleep(delayMs);
  }

  throw erroOpenAIResponses(model, 500, lastErr || "erro desconhecido");
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

/** Uma chamada Responses API (modelo fixo) — retry HTTP em postOpenAIResponses. */
async function responsesComSchemaOnce<T>(opts: {
  content: InputContentItem[];
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  model: string;
}): Promise<T> {
  const input: Array<{
    role: string;
    content: Array<{ type: string; text?: string; file_id?: string; image_url?: string }>;
  }> = [];

  if (opts.systemPrompt?.trim()) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: opts.systemPrompt.trim() }],
    });
  }

  input.push({
    role: "user",
    content: [{ type: "input_text", text: opts.instrucao }, ...opts.content],
  });

  const body = {
    model: opts.model,
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

  const data = await postOpenAIResponses(body, opts.model);
  const raw = extrairTextoOutput(data);
  return JSON.parse(raw) as T;
}

/** Chamada Responses API com retry HTTP + fallback de modelo (gpt-5 → gpt-4o-mini). */
export async function responsesComSchema<T>(opts: {
  content: InputContentItem[];
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  model?: string;
  taskName?: string;
}): Promise<T> {
  const { executarComFallback } = await import("@/lib/executar-com-fallback");
  const primary = opts.model ?? modeloPipelinePrincipal();
  const exec = await executarComFallback<T>({
    taskName: opts.taskName ?? "responses-schema",
    primaryModel: primary,
    run: (model) =>
      responsesComSchemaOnce<T>({
        content: opts.content,
        instrucao: opts.instrucao,
        systemPrompt: opts.systemPrompt,
        schema: opts.schema,
        model,
      }),
    validate: () => {},
  });
  return exec.resultado;
}

/** Chamada Responses API com PDF (file_id) e JSON Schema rígido. */
export async function responsesComPdfSchema<T>(opts: {
  fileId: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  model?: string;
}): Promise<T> {
  return responsesComSchemaOnce<T>({
    content: [{ type: "input_file", file_id: opts.fileId }],
    instrucao: opts.instrucao,
    systemPrompt: opts.systemPrompt,
    schema: opts.schema,
    model: opts.model ?? modeloPipelinePrincipal(),
  });
}

/** Chamada Responses API com imagem (data URL) e JSON Schema rígido. */
export async function responsesComImageSchema<T>(opts: {
  imageDataUrl: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  model?: string;
}): Promise<T> {
  return responsesComSchemaOnce<T>({
    content: [{ type: "input_image", image_url: opts.imageDataUrl }],
    instrucao: opts.instrucao,
    systemPrompt: opts.systemPrompt,
    schema: opts.schema,
    model: opts.model ?? modeloPipelinePrincipal(),
  });
}

export type ResponsesPdfOpts<T> = {
  fileId: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  taskName: string;
  validate: (data: T) => void;
};

export type ResponsesImageOpts<T> = {
  imageDataUrl: string;
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

/** Primary → validação → retry → fallback para imagem (data URL). */
export async function responsesComImageSchemaComValidacao<T>(
  opts: ResponsesImageOpts<T>
): Promise<{ data: T; model: string; tier: "primary" | "fallback"; attempt: number }> {
  const { executarComFallback } = await import("@/lib/executar-com-fallback");

  const exec = await executarComFallback<T>({
    taskName: opts.taskName,
    run: (model) =>
      responsesComImageSchema<T>({
        imageDataUrl: opts.imageDataUrl,
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

/** @deprecated Use responsesComImageSchemaComValidacao com validate. */
export async function responsesComImageSchemaComFallback<T>(opts: {
  imageDataUrl: string;
  instrucao: string;
  systemPrompt?: string;
  schema: JsonSchemaFormat;
  taskName?: string;
}): Promise<{ data: T; model: string }> {
  const r = await responsesComImageSchemaComValidacao<T>({
    ...opts,
    taskName: opts.taskName ?? "openai-image",
    validate: () => {},
  });
  return { data: r.data, model: r.model };
}
