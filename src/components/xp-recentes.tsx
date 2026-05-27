import { LABEL_TIPO_XP, ultimosEventosXp } from "@/lib/xp";
import { Card } from "@/components/ui";

export async function XpRecentes({ userId }: { userId: string }) {
  const eventos = await ultimosEventosXp(userId, 6);
  if (eventos.length === 0) return null;

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">XP recente</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {eventos.map((e) => (
          <li
            key={e.id}
            className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
          >
            <span className="text-slate-700">
              {LABEL_TIPO_XP[e.tipo] ?? e.tipo}
            </span>
            <span className="font-medium text-violet-800">+{e.pontos} XP</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
