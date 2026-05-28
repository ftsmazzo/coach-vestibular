import Link from "next/link";
import { Card, LinkButton } from "@/components/ui";
import type { AnamnesePublicView } from "@/lib/anamnese-types";

export function AnamneseBanner({ anamnese }: { anamnese: AnamnesePublicView }) {
  if (anamnese.status === "COMPLETED") return null;

  const emAndamento = anamnese.status === "IN_PROGRESS";
  const titulo = emAndamento ? "Continue: entendendo sua jornada" : "Primeiro passo com o copiloto";
  const descricao = emAndamento
    ? `Você parou em "${anamnese.stageLabel ?? "entrevista"}" (${anamnese.progressPct}%). São poucos minutos — depois disso personalizamos tudo para você.`
    : "Antes de olhar só números, o copiloto faz uma conversa guiada para conhecer sua história, rotina e como você se sente em prova. Não é chat aberto: tem começo, meio e fim.";

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-teal-50/40 p-5 sm:p-6 ring-1 ring-violet-100">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
        Conversa inicial · anamnese
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{titulo}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{descricao}</p>
      {emAndamento && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${anamnese.progressPct}%` }}
          />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/anamnese">
          {emAndamento ? "Continuar conversa" : "Começar agora (~10 min)"}
        </LinkButton>
        <Link
          href="/anamnese"
          className="self-center text-sm text-slate-600 underline hover:text-violet-800"
        >
          Por que isso importa?
        </Link>
      </div>
    </Card>
  );
}
