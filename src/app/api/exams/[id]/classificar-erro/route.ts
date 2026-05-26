import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ErrorType } from "@/generated/prisma/client";

function parseMateriaAssuntoFromObservacao(obsText: string): { materiaCorrigida: string; assuntoCorrigido: string } | null {
  const obs = obsText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (obs.includes("geografia")) {
    return {
      materiaCorrigida: "Geografia",
      assuntoCorrigido: obs.includes("fisic") ? "Geografia Física" : "Geografia Humana"
    };
  }
  if (obs.includes("historia")) {
    return {
      materiaCorrigida: "História",
      assuntoCorrigido: obs.includes("brasil") ? "Brasil República" : "História Contemporânea"
    };
  }
  if (obs.includes("ingles") || obs.includes("english")) {
    return {
      materiaCorrigida: "Português", // Languages grouped under Português in taxonomy
      assuntoCorrigido: "Interpretação de Texto"
    };
  }
  if (obs.includes("gramatica") || obs.includes("pronome") || obs.includes("tempo verbal") || obs.includes("tempos verbais") || obs.includes("conjuncao") || obs.includes("regencia") || obs.includes("crase")) {
    return {
      materiaCorrigida: "Português",
      assuntoCorrigido: "Gramática"
    };
  }
  if (obs.includes("literatura")) {
    return {
      materiaCorrigida: "Português",
      assuntoCorrigido: "Literatura"
    };
  }
  if (obs.includes("redacao")) {
    return {
      materiaCorrigida: "Português",
      assuntoCorrigido: "Redação"
    };
  }
  if (obs.includes("interpretacao") || obs.includes("leitura")) {
    return {
      materiaCorrigida: "Português",
      assuntoCorrigido: "Interpretação de Texto"
    };
  }
  if (obs.includes("biologia") || obs.includes("biologica") || obs.includes("citologia") || obs.includes("genetica") || obs.includes("ecologia") || obs.includes("fisiologia") || obs.includes("evolucao") || obs.includes("botanica")) {
    let assunto = "Biologia Geral";
    if (obs.includes("citologia")) assunto = "Citologia";
    else if (obs.includes("genetica")) assunto = "Genética";
    else if (obs.includes("ecologia")) assunto = "Ecologia";
    else if (obs.includes("fisiologia")) assunto = "Fisiologia Humana";
    else if (obs.includes("evolucao")) assunto = "Evolução";
    else if (obs.includes("botanica")) assunto = "Botânica";
    return {
      materiaCorrigida: "Biologia",
      assuntoCorrigido: assunto
    };
  }
  if (obs.includes("quimica") || obs.includes("estequiometria") || obs.includes("termoquimica") || obs.includes("equilibrio") || obs.includes("eletroquimica") || obs.includes("organica") || obs.includes("atomistica")) {
    let assunto = "Química Geral";
    if (obs.includes("estequiometria")) assunto = "Estequiometria";
    else if (obs.includes("termoquimica")) assunto = "Termoquímica";
    else if (obs.includes("equilibrio")) assunto = "Equilíbrio Químico";
    else if (obs.includes("eletroquimica")) assunto = "Eletroquímica";
    else if (obs.includes("organica")) assunto = "Química Orgânica";
    else if (obs.includes("atomistica")) assunto = "Atomística";
    return {
      materiaCorrigida: "Química",
      assuntoCorrigido: assunto
    };
  }
  if (obs.includes("fisica") || obs.includes("optica") || obs.includes("cinematica") || obs.includes("eletricidade") || obs.includes("ondas") || obs.includes("trabalho") || obs.includes("lente") || obs.includes("espelho") || obs.includes("dinamica") || obs.includes("energia")) {
    let assunto = "Física Geral";
    if (obs.includes("optica") || obs.includes("lente") || obs.includes("espelho")) assunto = "Óptica";
    else if (obs.includes("cinematica")) assunto = "Cinemática";
    else if (obs.includes("eletricidade")) assunto = "Eletricidade";
    else if (obs.includes("ondas")) assunto = "Ondas";
    else if (obs.includes("dinamica")) assunto = "Dinâmica";
    else if (obs.includes("energia") || obs.includes("trabalho")) assunto = "Trabalho e Energia";
    return {
      materiaCorrigida: "Física",
      assuntoCorrigido: assunto
    };
  }
  if (obs.includes("matematica") || obs.includes("calculo") || obs.includes("geometria") || obs.includes("trigonometria") || obs.includes("probabilidade") || obs.includes("algebra") || obs.includes("funcao")) {
    let assunto = "Matemática Geral";
    if (obs.includes("trigonometria")) assunto = "Trigonometria";
    else if (obs.includes("probabilidade")) assunto = "Probabilidade e Estatística";
    else if (obs.includes("algebra")) assunto = "Álgebra";
    else if (obs.includes("geometria")) assunto = "Geometria";
    else if (obs.includes("funcao")) assunto = "Funções";
    return {
      materiaCorrigida: "Matemática",
      assuntoCorrigido: assunto
    };
  }

  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  
  // Verify that the exam belongs to the user
  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.userId },
  });

  if (!exam) {
    return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { attempts } = body as {
      attempts: Array<{
        id: string;
        tipoErro: ErrorType | null;
        observacao: string | null;
        materiaCorrigida?: string | null;
        assuntoCorrigido?: string | null;
      }>;
    };

    if (!Array.isArray(attempts)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }

    // Update all attempts in a transaction
    await prisma.$transaction(
      attempts.map((att) => {
        let materiaCorrigida = att.materiaCorrigida || null;
        let assuntoCorrigido = att.assuntoCorrigido || null;

        // Fallback: heuristic parse from observacao text if not explicitly passed
        if (!materiaCorrigida && !assuntoCorrigido && att.observacao) {
          const parsed = parseMateriaAssuntoFromObservacao(att.observacao);
          if (parsed) {
            materiaCorrigida = parsed.materiaCorrigida;
            assuntoCorrigido = parsed.assuntoCorrigido;
          }
        }

        return prisma.questionAttempt.update({
          where: { id: att.id, examId: id },
          data: {
            tipoErro: att.tipoErro || null,
            observacao: att.observacao !== undefined ? att.observacao : undefined,
            materiaCorrigida: materiaCorrigida !== undefined ? materiaCorrigida : undefined,
            assuntoCorrigido: assuntoCorrigido !== undefined ? assuntoCorrigido : undefined,
          },
        });
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao salvar classificação de erros:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar classificação de erros" },
      { status: 500 }
    );
  }
}
