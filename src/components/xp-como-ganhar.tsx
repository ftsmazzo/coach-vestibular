import { XP_VALORES } from "@/lib/xp-valores";
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
        <li>
          <strong>+{XP_VALORES.PRIMEIRO_REGISTRO_SEMANA} XP</strong> — primeiro registro da semana.
        </li>
        <li>
          <strong>+{XP_VALORES.STREAK_3} / +{XP_VALORES.STREAK_7} XP</strong> — 3 ou 7 dias seguidos
          lançando resultado no app (conta o dia do cadastro, não a data da prova).
        </li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        No ranking, use um <strong>nome de exibição</strong> em{" "}
        <a href="/perfil" className="text-teal-700 underline">
          Perfil
        </a>{" "}
        (apelido livre) — ou deixe em branco para um apelido automático discreto.
      </p>
    </Card>
  );
}
