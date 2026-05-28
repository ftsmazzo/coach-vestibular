import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAnamneseStatus } from "@/lib/anamnese-motor";
import { AnamneseChat } from "@/components/anamnese-chat";

export default async function AnamnesePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const anamnese = await getAnamneseStatus(session.userId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-teal-700 hover:underline">
          ← Voltar à Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Entendendo sua jornada</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Uma conversa guiada com o copiloto — para conhecer sua história, rotina e como você se
          comporta em prova, <strong>antes</strong> de julgar só pelos números. Quando terminar, isso
          some da Home e vira memória do motor (diagnóstico, plano e tarefas).
        </p>
      </div>

      <AnamneseChat initial={anamnese} />
    </div>
  );
}
