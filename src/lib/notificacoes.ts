/**
 * Notificações do copiloto → webhook (N8N) → WhatsApp (Evolution).
 * O app compõe a mensagem e o destinatário; o N8N só entrega.
 * - numero: WhatsApp do aluno (E.164 sem +). Se null, o N8N usa o número admin.
 * Best-effort: nunca quebra o fluxo principal.
 */
import { normalizarTelefone } from "@/lib/telefone";

export type EventoCopiloto =
  | "report_novo"
  | "bug_resolvido"
  | "sugestao_acatada"
  | "classificacao_aceita"
  | "nova_prova"
  | "quest_lembrete"
  | "ciclo_fechando";

export function telefoneParaWhatsapp(raw: string | null | undefined): string | null {
  return normalizarTelefone(raw);
}

export async function enviarNotificacao(payload: {
  evento: EventoCopiloto;
  numero: string | null;
  mensagem: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
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
      body: JSON.stringify({ app: "coach-vestibular", ...payload }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    console.error(`[notificacoes:${payload.evento}] falha no webhook:`, e);
  }
}
