import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";

const schema = z.object({
  mensagemBase: z.string(),
  focos: z.array(z.string()),
  recoveryMode: z.boolean(),
});

/**
 * Fase 2 — Narrativa empática via IA (opcional).
 * Requer OPENAI_API_KEY. Sem chave, devolve template enriquecido localmente.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = schema.parse(await request.json());
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const prefix = body.recoveryMode
      ? "🌱 Modo recuperação: "
      : "📊 ";
    return NextResponse.json({
      narrative: `${prefix}${body.mensagemBase}`,
      source: "template",
    });
  }

  const systemPrompt = `Você apoia estudantes de vestibular (medicina). Reescreva o diagnóstico de forma empática e breve (máx. 3 frases).
NUNCA: diagnóstico médico/psicológico, culpar o aluno, comparar com outros, prometer aprovação.
SEMPRE: validar esforço, focar em tendência e próximos passos pequenos.
Focos: ${body.focos.join(", ")}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.mensagemBase },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error("OpenAI error");
    const data = await res.json();
    const narrative = data.choices?.[0]?.message?.content ?? body.mensagemBase;
    return NextResponse.json({ narrative, source: "openai" });
  } catch {
    return NextResponse.json({
      narrative: body.mensagemBase,
      source: "fallback",
    });
  }
}
