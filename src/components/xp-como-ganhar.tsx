import { XP_VALORES } from "@/lib/xp";
import { Card } from "@/components/ui";

export function XpComoGanhar() {
  return (
    <Card className="border-violet-100 bg-violet-50/30">
      <h2 className="font-semibold text-slate-900">Como ganhar XP</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        <li>
          <strong>+{XP_VALORES.MELHORIA_MATERIA} XP</strong> — melhorou pelo menos 10 pontos
          percentuais em uma matéria em relação ao seu registro anterior da mesma prova.
        </li>
        <li>
          <strong>+{XP_VALORES.QUESTS_SEMANA} XP</strong> — concluiu todas as quests práticas do
          plano da semana.
        </li>
        <li>
          <strong>+{XP_VALORES.SUGESTAO_ACEITA} XP</strong> — sugestão de classificação aceita pela
          equipe.
        </li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        No ranking, os nomes aparecem como apelidos (ex.: Estudante M.ma.sa) para ninguém saber quem
        é quem no cursinho.
      </p>
    </Card>
  );
}
