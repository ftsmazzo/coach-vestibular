import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { regenerarPlanoGlobalUsuario } from "@/lib/prova-attempt";

function mensagemResultado(r: Awaited<ReturnType<typeof regenerarPlanoGlobalUsuario>>): string {
  if (r.fonte === "anamnese") {
    return `Plano recriado com base na sua anamnese (${r.blocosPlano} blocos) e ${r.questsPendentes} tarefa(s) em Quests. Quando registrar provas, atualize de novo para cruzar com erros reais.`;
  }
  if (r.fonte === "jornada") {
    return `Plano e quests atualizados pela jornada (${r.blocosPlano} blocos, ${r.questsPendentes} tarefa(s) pendentes).`;
  }
  return "Plano criado, mas ainda vazio: faça a anamnese na Home ou registre uma atividade no catálogo.";
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Use o painel admin" }, { status: 403 });
  }

  try {
    const resultado = await regenerarPlanoGlobalUsuario(session.userId);

    revalidatePath("/dashboard");
    revalidatePath("/plano");
    revalidatePath("/quests");

    return NextResponse.json({
      ok: true,
      ...resultado,
      mensagem: mensagemResultado(resultado),
      atualizadoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error("regenerar plano:", e);
    return NextResponse.json(
      { error: "Não foi possível atualizar o plano. Tente de novo em alguns segundos." },
      { status: 500 }
    );
  }
}
