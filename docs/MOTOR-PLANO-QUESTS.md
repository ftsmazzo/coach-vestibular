# Motor de Plano Semanal e Quests da Jornada

Este documento especifica o comportamento esperado para a geração de plano semanal e quests no Coach Vestibular.

Ele complementa `docs/MOTOR-JORNADA-DIAGNOSTICO.md` e passa a ser a fonte normativa para a Etapa 4 do motor de Jornada.

---

## 1. Princípio central

O plano semanal não é diagnóstico.

O diagnóstico responde:

> Por que este aluno precisa de intervenção?

O ciclo semanal responde:

> Qual foco será trabalhado nesta semana?

O plano semanal responde:

> Como organizar a intervenção da semana?

A quest responde:

> Qual ação concreta, pequena e verificável o aluno deve executar?

Fluxo correto:

```text
Provas + anamnese
→ Diagnóstico Inicial
→ LearningCycle ativo
→ StudyPlan semanal
→ Quests
→ Mini-quiz/fechamento local
→ Nova prova/simulado para confirmação global
```

Fluxo proibido:

```text
Prova isolada
→ Plano genérico automático
→ Quests soltas
→ Domínio consolidado
```

---

## 2. Problema que este motor deve evitar

Testes iniciais indicaram risco de quests:

- genéricas;
- incompreensíveis;
- sem relação clara com o erro real;
- sem critério objetivo de conclusão;
- parecidas com conselho motivacional;
- desconectadas do N2/N3;
- sem relação com metadados cognitivos;
- criadas em volume excessivo.

Este motor existe para impedir esse comportamento.

Toda quest precisa responder claramente:

1. Por que fui gerada?
2. Qual evidência do diagnóstico sustenta esta tarefa?
3. O que o aluno deve fazer exatamente?
4. Como o aluno sabe que concluiu?
5. Qual erro ou hipótese cognitiva esta tarefa tenta observar?

---

## 3. Fontes obrigatórias

O plano semanal e as quests devem nascer de:

- `JourneyDiagnosticSnapshot` tipo `INICIAL` ou diagnóstico atual futuro;
- `LearningCycle` ativo;
- `baselineJson` do ciclo;
- `narrativaInicioJson` do ciclo;
- `conhecimentoEscopoId`;
- `conhecimentoDominioId`;
- `conhecimentoExigido`/N3;
- `tipoErro`;
- `metadadosCognitivosJson`;
- `observacao` do aluno, quando existir;
- `StudentAnamnesis`, como modulador de carga e linguagem.

`materiaId` e `temaId` podem ser usados apenas como compatibilidade visual/legada. Eles não são a fonte principal do plano.

---

## 4. O que é StudyPlan neste motor

`StudyPlan` é o contrato organizado da semana.

Ele deve registrar:

- ciclo de origem;
- foco principal;
- escopo alvo;
- hipótese diagnóstica;
- carga estimada;
- blocos de intervenção;
- quests vinculadas;
- critério local de fechamento;
- limites da interpretação.

O plano semanal não deve recalcular diagnóstico.

Ele deve ler o diagnóstico e o ciclo ativo, depois organizar ações.

---

## 5. O que é Quest neste motor

Quest é uma ação atômica.

Ela deve ser:

- pequena;
- objetiva;
- verificável;
- ligada a um escopo N2;
- ligada, quando possível, a um conhecimento exigido N3;
- ligada a uma hipótese cognitiva;
- compreensível para o aluno;
- executável sem depender de interpretação ambígua.

Exemplos ruins:

```text
Estudar gases.
Revisar matemática.
Melhorar interpretação.
Fazer exercícios.
Ver teoria.
```

Exemplos bons:

```text
Refaça 3 questões erradas de gases ideais. Antes de calcular, escreva P, V, n e T em uma linha separada e marque a unidade de cada grandeza.

Explique em 5 linhas quando usar PV = nRT e quando uma regra de três simples não basta. Depois compare sua explicação com o resumo do conteúdo.

Resolva 5 questões do mesmo escopo. Em cada uma, destaque o comando da pergunta e anote qual dado do enunciado foi decisivo.

Escolha 2 alternativas erradas de uma questão já resolvida e explique por que elas parecem plausíveis, mas estão incorretas.
```

---

## 6. Quantidade de quests

Para o MVP:

- mínimo: 2 quests;
- padrão: 3 quests;
- máximo: 4 quests.

A quantidade deve ser modulada pela anamnese.

Se a anamnese indicar rotina limitada, baixa disponibilidade, cansaço, sobrecarga ou dificuldade de constância, priorizar 2 ou 3 quests.

Se a anamnese indicar boa disponibilidade e alta autonomia, permitir até 4 quests.

Nunca gerar excesso de tarefas para parecer mais completo.

---

## 7. Tipos de quests no MVP

Nesta etapa, usar apenas os tipos abaixo:

### 7.1 REVISAO_ERRO

Objetivo: transformar erro real em evidência de aprendizagem.

Deve pedir ao aluno para revisitar questões erradas, identificar o ponto de falha e reexecutar com método.

### 7.2 CONCEITO_BASE

Objetivo: reconstruir uma base conceitual frágil.

Deve pedir explicação curta, mapa mínimo, cartão-resumo, comparação entre conceitos ou reconstrução de regra.

### 7.3 TREINO_GUIADO

Objetivo: praticar o escopo com procedimento explícito.

Deve indicar passo a passo operacional, não apenas “resolver exercícios”.

### 7.4 METACOGNICAO

Objetivo: tornar o erro visível para o aluno.

Deve pedir registro do tipo de erro, comparação entre alternativas, justificativa do raciocínio ou checklist antes/depois.

Tipos reservados para etapas futuras:

- `TREINO_CRONOMETRADO`;
- `MINI_SIMULADO_PREPARATORIO`;
- `MINI_QUIZ_FECHAMENTO`.

---

## 8. Como metadados cognitivos influenciam quests

O mesmo escopo deve gerar quests diferentes conforme o padrão de erro.

### 8.1 CONCEITO_TEORICO

Priorizar:

- CONCEITO_BASE;
- explicação com exemplo;
- reconstrução de regra;
- treino guiado simples.

Não priorizar treino cronometrado nesta etapa.

### 8.2 CALCULO_BOBEIRA

Priorizar:

- checklist operacional;
- conversão de unidade;
- reexecução de passos;
- comparação entre conta original e conta corrigida.

### 8.3 INTERPRETACAO_ENUNCIADO

Priorizar:

- leitura ativa;
- marcação de comando;
- separação entre dado, pergunta e distração;
- justificativa antes da resolução.

### 8.4 FALTA_TEMPO

Nesta etapa, não transformar diretamente em treino cronometrado pesado.

Priorizar:

- redução de carga;
- organização de passos;
- identificação de gargalo;
- treino guiado curto.

### 8.5 CHUTE_TOTAL

Priorizar:

- reconstrução conceitual;
- análise de alternativas;
- explicação do motivo de cada alternativa estar correta/incorreta;
- retomada de conceito base.

### 8.6 ERRO_DE_ATENCAO

Priorizar:

- checklist antes de marcar resposta;
- conferência de unidade, sinal, grandeza e comando;
- reexecução de questão já errada com pausa obrigatória.

---

## 9. Estrutura mínima de uma quest

Cada quest deve ter, no mínimo:

```ts
type QuestJornada = {
  cicloId: string;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  tipoQuest: "REVISAO_ERRO" | "CONCEITO_BASE" | "TREINO_GUIADO" | "METACOGNICAO";
  titulo: string;
  descricao: string;
  criterioConclusao: string;
  duracaoEstimadaMin?: number;
  dificuldade?: "LEVE" | "MEDIA" | "FORTE";
  fonteDiagnosticoJson: {
    origem: "LearningCycle" | "JourneyDiagnosticSnapshot";
    cicloId: string;
    snapshotId?: string;
    escopoId?: string | null;
    dominioId?: string | null;
    conhecimentoExigido?: string[];
    tiposErro?: Record<string, number>;
    motivo: string;
  };
};
```

A `descricao` deve ser uma instrução de tarefa, não um texto motivacional.

O `criterioConclusao` deve ser observável.

Exemplo ruim:

```text
Concluir quando entender o conteúdo.
```

Exemplo bom:

```text
Concluir quando tiver refeito 3 questões, registrado P/V/n/T em cada uma e escrito uma frase explicando o erro original.
```

---

## 10. Estrutura do StudyPlan semanal

O `StudyPlan` deve guardar a organização da semana.

Formato sugerido para `itemsJson`:

```ts
type StudyPlanJornadaItems = {
  versao: "1.0";
  origem: "LearningCycle";
  cicloId: string;
  snapshotId?: string;
  foco: {
    titulo: string;
    escopoId?: string | null;
    dominioId?: string | null;
    motivo: string;
  };
  carga: {
    questsTotal: number;
    duracaoTotalEstimadaMin: number;
    intensidade: "LEVE" | "PADRAO" | "FORTE";
    moduladaPorAnamnese: boolean;
  };
  blocos: Array<{
    ordem: number;
    tipo: "REVISAO" | "CONCEITO" | "TREINO" | "METACOGNICAO";
    titulo: string;
    objetivo: string;
    questIds: string[];
  }>;
  limites: string[];
};
```

Formato sugerido para `narrativeJson`:

```ts
type StudyPlanJornadaNarrative = {
  titulo: string;
  mensagem: string;
  focoDaSemana: string;
  porQueEssePlano: string;
  comoExecutar: string;
  criterioDeFechamentoLocal: string;
  limiteDaInterpretacao: string;
};
```

---

## 11. Idempotência

A geração precisa ser idempotente.

Regra:

```text
Se já existe StudyPlan semanal para o ciclo ativo:
  retornar existente.

Se já existem Quests vinculadas ao ciclo:
  retornar existentes.

Se não existe:
  criar StudyPlan + Quests.
```

Não duplicar quests ao recarregar dashboard, clicar duas vezes ou chamar API duas vezes.

---

## 12. Relação entre plano, quests e diagnóstico global

Criar plano não altera diagnóstico global.

Criar quest não altera diagnóstico global.

Concluir quest não consolida domínio global.

Concluir todas as quests não deve criar `JourneyDiagnosticSnapshot` de atualização.

Nesta etapa, é proibido:

- marcar escopo como `CONSOLIDADO`;
- criar `JourneyDiagnosticSnapshot` tipo `ATUALIZACAO`;
- criar `JourneyDiagnosticSnapshot` tipo `FECHAMENTO_CICLO`;
- criar `JourneyDiagnosticSnapshot` tipo `POS_PROVA`;
- preencher `resultadoJson` do ciclo;
- preencher `narrativaFimJson` do ciclo;
- fechar o ciclo;
- gerar mini-quiz.

O máximo que quests podem fazer nesta etapa é existir, ser exibidas e eventualmente ter status de execução se a estrutura atual já suportar.

---

## 13. Linguagem das quests

A linguagem deve ser:

- direta;
- curta;
- compreensível;
- específica;
- orientada a ação;
- sem jargão desnecessário;
- sem promessa de domínio;
- sem tom infantilizado.

Toda quest deve evitar frases vagas como:

```text
Reforce seus conhecimentos.
Aprofunde seus estudos.
Treine mais este conteúdo.
Busque entender melhor.
```

Preferir verbos observáveis:

```text
refaça;
marque;
escreva;
compare;
explique;
resolva;
registre;
separe;
confira;
classifique;
justifique.
```

---

## 14. Validador de qualidade das quests

Antes de salvar, cada quest deve passar por validação determinística.

Uma quest é inválida se:

- não tem `conhecimentoEscopoId`, salvo quest cognitiva/rotina claramente justificada;
- título tem menos de 8 caracteres;
- descrição tem menos de 80 caracteres;
- não contém verbo de ação;
- não contém critério de conclusão;
- não contém `fonteDiagnosticoJson`;
- usa linguagem genérica proibida;
- promete domínio/consolidação global;
- pede tarefa impossível ou ambígua;
- cria dependência de material inexistente sem alternativa;
- não se relaciona ao foco do ciclo.

Se a quest gerada for inválida, o motor deve:

1. tentar gerar uma versão determinística segura;
2. se ainda falhar, não salvar a quest;
3. registrar motivo de bloqueio em log estruturado;
4. manter o plano em estado incompleto/pendente, sem inventar tarefa genérica.

---

## 15. Templates determinísticos mínimos

Para evitar quests ruins, o MVP deve ter templates determinísticos por tipo.

### REVISAO_ERRO

```text
Refaça {n} questão(ões) errada(s) do escopo {escopoLabel}. Antes de olhar a correção, escreva: qual era o comando da questão, qual dado era decisivo e onde seu raciocínio mudou. Conclua registrando em uma frase o erro principal.
```

### CONCEITO_BASE

```text
Escreva um resumo de 6 a 8 linhas sobre {escopoLabel}, incluindo quando usar a ideia principal, quais sinais do enunciado indicam esse conteúdo e um exemplo simples. Conclua criando 3 perguntas que você deveria saber responder sobre esse escopo.
```

### TREINO_GUIADO

```text
Resolva {n} questões do escopo {escopoLabel}. Em cada uma, siga o roteiro: marque o comando, liste os dados relevantes, escolha a fórmula/regra/conceito antes de calcular ou responder, e só então marque a alternativa.
```

### METACOGNICAO

```text
Revise suas respostas no escopo {escopoLabel} e classifique cada erro em uma categoria: conceito, interpretação, cálculo, atenção ou tempo. Depois escreva qual categoria mais apareceu e qual atitude você vai testar na próxima resolução.
```

Os templates podem ser enriquecidos com N3 e metadados cognitivos, mas nunca devem perder objetividade.

---

## 16. Uso de IA

A IA pode ser usada para melhorar linguagem e contextualizar a quest, mas não deve ter liberdade total.

Entrada da IA deve conter:

- foco do ciclo;
- escopoId;
- domínioId;
- N3 recorrentes;
- tipos de erro;
- baseline do ciclo;
- limites de linguagem;
- tipos permitidos de quest;
- quantidade máxima.

Saída da IA deve obedecer schema rígido.

Depois da IA, aplicar validador determinístico.

Se a IA falhar, usar templates determinísticos.

Para o MVP, é aceitável iniciar sem IA, usando templates determinísticos bons.

---

## 17. UI esperada

A UI deve mostrar:

- Plano da Semana 1;
- foco principal;
- motivo do foco;
- carga estimada;
- lista de quests;
- por que cada quest existe;
- critério de conclusão de cada quest;
- aviso de limite.

Aviso obrigatório:

```text
Concluir as quests mostra adesão e resposta local à intervenção. A confirmação de evolução global virá em uma nova prova ou simulado completo.
```

Não mostrar ainda:

- domínio consolidado;
- evolução global;
- fechamento semanal;
- mini-quiz;
- ranking de evolução por quest;
- diagnóstico atualizado.

---

## 18. Regras de compatibilidade com legado

Não reativar fluxo antigo de plano global automático.

Não chamar `aplicarPlanoEQuests` ou `regenerarPlanoGlobalUsuario` sem revisar e adaptar ao novo motor.

Se for necessário reutilizar `StudyPlan.escopo = "GLOBAL"` por compatibilidade de UI, então exigir:

- `fonteGeracao = "motor-jornada-v1"`;
- `LearningCycle` ativo;
- `JourneyDiagnosticSnapshot` inicial;
- `jornadaIniciadaEm` preenchido;
- idempotência por ciclo;
- bloqueio de qualquer atualização diagnóstica global.

Preferência conceitual:

```text
StudyPlan.escopo = "JORNADA_SEMANAL"
```

Mas a escolha final pode depender da compatibilidade do schema e da UI atual.

---

## 19. Critérios de aceite da Etapa 4

A Etapa 4 só estará correta se:

1. Plano nasce do `LearningCycle` ativo.
2. Quests nascem do foco e baseline do ciclo.
3. Cada quest tem fonte diagnóstica explícita.
4. Cada quest tem critério de conclusão claro.
5. Nenhuma quest é genérica.
6. Há no máximo 4 quests.
7. A anamnese modula carga, não inventa diagnóstico.
8. O plano não altera diagnóstico global.
9. Quest concluída não consolida domínio.
10. Não há mini-quiz ainda.
11. Não há fechamento semanal ainda.
12. Não há `JourneyDiagnosticSnapshot` de atualização.
13. Não há duplicação por múltiplos cliques.
14. O fluxo legado não volta.
15. Há testes cobrindo quests genéricas e incompreensíveis.

---

## 20. Próximas etapas fora deste documento

Ficam para etapas posteriores:

- mini-quiz de fechamento;
- cálculo de aderência semanal;
- `resultadoJson` do ciclo;
- `narrativaFimJson`;
- `JourneyDiagnosticSnapshot` tipo `FECHAMENTO_CICLO`;
- `JourneyDiagnosticSnapshot` tipo `POS_PROVA`;
- diagnóstico atual mutável;
- confirmação global por nova prova/simulado;
- evolução/retração longitudinal.
