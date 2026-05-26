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

export function modeloPipelinePrincipal(): string {
  return (
    process.env.OPENAI_MODEL_PIPELINE?.trim() ||
    process.env.OPENAI_MODEL_PASSO_2?.trim() ||
    "gpt-4o"
  );
}

export function modeloPipelineFallback(): string {
  return (
    process.env.OPENAI_MODEL_PIPELINE_FALLBACK?.trim() ||
    process.env.OPENAI_MODEL_PASSO_2?.trim() ||
    "gpt-4o"
  );
}

/** Envia PDF ao Files API (purpose user_data). */
export async function uploadPdfBuffer(
  buffer: Buffer,
  filename = "prova.pdf"
): Promise<string> {
  const apiKey = getApiKey();
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
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
  schema: JsonSchemaFormat;
  model?: string;
}): Promise<T> {
  const apiKey = getApiKey();
  const model = opts.model ?? modeloPipelinePrincipal();

  const body = {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: opts.instrucao },
          { type: "input_file", file_id: opts.fileId },
        ],
      },
    ],
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

export async function responsesComPdfSchemaComFallback<T>(opts: {
  fileId: string;
  instrucao: string;
  schema: JsonSchemaFormat;
}): Promise<{ data: T; model: string }> {
  try {
    const model = modeloPipelinePrincipal();
    const data = await responsesComPdfSchema<T>({ ...opts, model });
    return { data, model };
  } catch (e1) {
    const fallback = modeloPipelineFallback();
    if (fallback === modeloPipelinePrincipal()) throw e1;
    const data = await responsesComPdfSchema<T>({ ...opts, model: fallback });
    return { data, model: fallback };
  }
}
