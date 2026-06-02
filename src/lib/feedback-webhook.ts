/**
 * Dispara o report para um webhook (N8N) — não bloqueia a gravação no banco.
 * Configure N8N_FEEDBACK_WEBHOOK_URL no ambiente.
 */
export type FeedbackWebhookPayload = {
  id: string;
  tipo: string;
  status: string;
  titulo: string;
  descricao: string;
  esperado: string | null;
  severidade: string | null;
  pagina: string | null;
  contexto: Record<string, unknown> | null;
  temAnexo: boolean;
  aluno: { id: string; nome: string; email: string };
  criadoEm: string;
  appUrl: string | null;
};

export async function enviarFeedbackWebhook(payload: FeedbackWebhookPayload): Promise<void> {
  const url = process.env.N8N_FEEDBACK_WEBHOOK_URL?.trim();
  if (!url) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_FEEDBACK_WEBHOOK_SECRET
          ? { "X-Webhook-Secret": process.env.N8N_FEEDBACK_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    // Webhook é best-effort: o report já está salvo no banco.
    console.error("[feedback-webhook] falha ao notificar N8N:", e);
  }
}
