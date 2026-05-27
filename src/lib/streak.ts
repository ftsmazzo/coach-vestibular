/** Início do dia no fuso local do servidor (adequado para VPS BR). */
export function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export interface StreakRegistros {
  /** Dias seguidos com pelo menos um lançamento no app (por createdAt). */
  streak: number;
  /** Último dia com lançamento (início do dia). */
  ultimoDia: Date | null;
  /** Se o aluno ainda pode manter o streak registrando hoje (ontem contou, hoje ainda não). */
  pendenteHoje: boolean;
}

/**
 * Sequência de dias em que o aluno registrou resultado no app.
 * Usa `createdAt` (quando cadastrou), não `data` (dia em que a prova foi aplicada).
 */
export function calcularStreakRegistros(
  instants: Date[],
  referencia: Date = new Date()
): StreakRegistros {
  if (instants.length === 0) {
    return { streak: 0, ultimoDia: null, pendenteHoje: false };
  }

  const diasMs = new Set(instants.map((d) => inicioDoDia(d).getTime()));
  const hoje = inicioDoDia(referencia).getTime();

  let startOffset = 0;
  if (!diasMs.has(hoje)) {
    const ontem = new Date(referencia);
    ontem.setDate(ontem.getDate() - 1);
    if (diasMs.has(inicioDoDia(ontem).getTime())) {
      startOffset = 1;
    } else {
      const ultimo = Math.max(...diasMs);
      return {
        streak: 0,
        ultimoDia: new Date(ultimo),
        pendenteHoje: false,
      };
    }
  }

  let streak = 0;
  for (let i = startOffset; i < 400; i++) {
    const day = new Date(referencia);
    day.setDate(day.getDate() - i);
    const key = inicioDoDia(day).getTime();
    if (diasMs.has(key)) streak++;
    else break;
  }

  const ultimo = Math.max(...diasMs);
  const pendenteHoje = startOffset === 1 && streak > 0;

  return {
    streak,
    ultimoDia: new Date(ultimo),
    pendenteHoje,
  };
}

export function textoStreakDashboard(info: StreakRegistros): string {
  if (info.streak === 0) {
    return "Registre um resultado hoje para começar sua sequência.";
  }
  if (info.pendenteHoje) {
    return "Você registrou ontem — lance hoje para manter a sequência.";
  }
  if (info.streak === 1) {
    return "1 dia seguido lançando resultado no app.";
  }
  return `${info.streak} dias seguidos lançando resultado no app.`;
}
