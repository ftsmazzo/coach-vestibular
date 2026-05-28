import { itensContextoJornadaNoPlano } from "@/lib/jornada-plano";

/** Texto do bloco Panorama sempre lê a jornada atual (não o JSON congelado do plano). */
export async function PanoramaJornadaLive({ userId }: { userId: string }) {
  const items = await itensContextoJornadaNoPlano(userId);
  const texto = items[0]?.descricao;
  if (!texto) return null;

  return (
    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
      {texto.replace(/\*\*/g, "")}
    </p>
  );
}
