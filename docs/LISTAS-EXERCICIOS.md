# Listas de exercícios — estrutura funcional (planejamento)

## Problema da “lista rápida”

Registrar só números de erro, sem banco de questões nem gabarito cruzado, produz diagnóstico fraco (matéria estimada, assunto vazio). Foi **pausada** em maio/2026.

## Princípio

O mesmo que provas/simulados do catálogo: cada questão com **matéria + assunto**, gabarito de referência e **respostas do aluno** comparadas — aí o plano e as quests fazem sentido.

## Três caminhos

### 1. Lista publicada no catálogo (prioridade)

- Aluno envia PDF em `/listas/solicitar`
- Admin cadastra `Prova` tipo `LISTA_FIXACAO` (pipeline existente)
- Aluno usa **Atividades** → Lente / Análise / Corrigir gabarito

### 2. Lista privada do aluno

Modelo de dados: `Prova` com `publicada: false` + `criadorUserId` (campo futuro) ou flag equivalente.

Fluxo wizard:

1. Nome, data, total de questões
2. Gabarito oficial (lote `numero,letra` ou sequência)
3. Respostas do aluno (mesmo formato) **ou** só erros com matéria/tema por questão
4. `registrarTentativaProva` — reutiliza motor atual
5. `modoUso: TREINO`, peso menor na jornada

### 3. Importação CSV

Colunas: `numero_questao`, `acertou`, `materia`, `tema`  
API existente: `POST /api/exams/import` (evoluir para `modoUso: TREINO` fixo e tipo lista).

## Fases de implementação

| Fase | Entrega |
|------|---------|
| A | UI “em construção” + solicitar PDF (feito) |
| B | Admin: fila `/admin/solicitacoes` + armazenamento PDF (feito) |
| C | Prova privada + wizard gabarito × respostas |
| D | CSV na UI de listas |
| E | (Opcional) IA assistida na colagem, revisão humana |

## Atividades (catálogo)

- Sem botão “Registrar resultado” nos cards
- Sem registro: **Análise/Dados** → Lente (registro do 1º resultado lá)
- Com registro: **Análise** → diagnóstico; **Corrigir gabarito** só dentro da análise
