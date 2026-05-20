# Arquitetura — Banco de provas

## Visão

1. **Admin** cadastra a **Prova** (vestibular, ano, caderno, dia).
2. **Uma linha por questão** em `ProvaQuestao` — só classificação pedagógica:

| Coluna | Exemplo |
|--------|---------|
| numero | 42 |
| areaBloco | Ciências da Natureza |
| materia | Física |
| assunto | Ondas |
| conhecimentoExigido | Calcular período a partir do gráfico |
| gabarito | D (pode preencher depois) |

3. **Aluno** escolhe **qual prova fez** e informa respostas ou erros.
4. Sistema compara com `gabarito` e grava `Exam` + `QuestionAttempt`.
5. Diagnóstico usa matéria + assunto já na prova.

## Fluxo admin

1. `/admin/provas` — criar prova (nome, banca, ano, caderno, total).
2. `/admin/provas/[id]` — editar registro da prova; extrair IA ou importar CSV.
3. Gabarito em lote quando souber o oficial.
4. **Publicar** para alunos.

## Fluxo aluno

1. `/simulados/novo` — dropdown com provas publicadas (nome · ano · caderno).
2. Respostas ou lista de erros.
3. POST `/api/exams/from-prova`.

## IA

Extração classifica apenas questões; metadados da prova vêm do cadastro. Ver `docs/EXTRACAO-IA.md`.
