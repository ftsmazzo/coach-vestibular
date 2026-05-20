# Arquitetura — Banco de provas

## Visão (o que você pediu ao GPT)

1. **Admin** cadastra a **Prova** (ENEM, simulado, vestibular).
2. **Uma linha por questão** na tabela `ProvaQuestao`:

| Coluna | Exemplo |
|--------|---------|
| numero | 42 |
| caderno | Azul |
| materia | Física |
| assunto | Ondas |
| conhecimentoExigido | Frequência, período, velocidade de propagação |
| gabarito | D (pode preencher depois) |

3. **Aluno** escolhe a prova e informa só **suas respostas** (ou lista de erros).
4. Sistema **compara** com `gabarito` da linha e grava histórico detalhado (`Exam` + `QuestionAttempt` + `provaQuestaoId`).
5. **Diagnóstico / plano / quests** usam matéria + assunto já parametrizados.

## Fluxo admin

1. `/admin/provas` — criar prova (nome, banca, tipo, total).
2. `/admin/provas/[id]` — importar CSV ou colar tabela do GPT.
3. Atualizar gabarito em lote (`numero,letra` por linha) quando souber o oficial.
4. **Publicar** para alunos.

### Prompt sugerido para o GPT (gerar CSV)

```
Analise esta prova [colar PDF/texto]. Gere CSV com colunas:
numero,caderno,materia,assunto,conhecimento_exigido,gabarito
Uma linha por questão. Matéria = grupo grande (Química, Física...).
Assunto = tema específico. Gabarito deixe vazio se não souber.
```

Template: `docs/templates/prova-questoes.csv`

## Fluxo aluno

1. `/simulados/novo` — escolhe prova publicada.
2. Cola sequência de respostas OU informa só erros.
3. POST `/api/exams/from-prova` → diagnóstico automático.

## Próximos passos

- Upload PDF da prova → IA preenche `ProvaQuestao` (como seu agente GPT).
- IA classifica questões novas ao importar.
- Histórico comparativo entre tentativas na mesma prova.
