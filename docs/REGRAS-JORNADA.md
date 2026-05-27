# Jornada, modo de uso e colaboração

## Três camadas

1. **Jornada (macro)** — todos os registros do aluno, com pesos diferentes (`modoUso`).
2. **Prova do catálogo (meso)** — várias tentativas da mesma `Prova`.
3. **Registro (micro)** — página `/simulados/[id]` de uma tentativa.

## Modo de uso (`Exam.modoUso`)

| Valor | Significado | Peso no plano/jornada |
|-------|-------------|------------------------|
| `OFICIAL` | ENEM, vestibular, simulado “dia D” | 3 |
| `TREINO` | Simulado de cursinho, lista de fixação | 1,5 |
| `REVISAO_PROVA_ANTIGA` | Prova de outro ano refeita para treinar | 1 |

O peso efetivo vem da **finalidade escolhida pelo aluno** no registro, não só do `Prova.tipo` do admin. O tipo da prova sugere o padrão inicial (`modoUsoPadraoParaProva`).

## Sugestões colaborativas

- Aluno: em cada questão do registro, link **Classificação errada?**
- Admin: `/admin/sugestoes` — aceitar (opcional aplicar no `ProvaQuestao`) ou rejeitar.
- Aceite: `+25 XP` no `User.xp` (base para ranking/moeda interna depois).

## Próximos passos (produto)

- Plano semanal agregando a jornada (não só o último `Exam`).
- Histórico por prova do catálogo.
- Ranking e recompensas visíveis no dashboard do aluno.
