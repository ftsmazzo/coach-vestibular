# Motor de Jornada e Diagnóstico — Coach Vestibular

> Versão: 1.0  
> Status: especificação conceitual e funcional para o MVP  
> Escopo: diagnóstico, jornada longitudinal e atualização do progresso  
> Fora de escopo neste documento: desenho detalhado de planos semanais, quests, UX final e implementação de prompts de geração de tarefas.

---

## 1. Princípio central

O Coach Vestibular não deve tratar uma prova isolada como diagnóstico definitivo.

Uma prova isolada gera evidências.  
Duas ou mais provas/simulados válidos permitem iniciar uma jornada.  
A jornada é o acompanhamento longitudinal do aluno, cruzando desempenho, conhecimento exigido, padrão cognitivo do erro e contexto pessoal.

O diagnóstico não é uma lista de tarefas.

O diagnóstico responde:

> “O que as evidências mostram sobre como este aluno aprende, erra, evolui, retrai e prioriza?”

O plano semanal responde:

> “Que intervenção prática será feita agora a partir desse diagnóstico?”

A quest responde:

> “Qual tarefa concreta executa parte dessa intervenção?”

O mini-quiz responde:

> “A intervenção da semana produziu algum sinal local de melhora?”

Uma nova prova ou simulado completo responde:

> “Essa melhora transferiu para uma situação real de prova?”

---

## 2. Decisões fechadas para o MVP

### 2.1 Jornada não começa na primeira prova

No MVP, a Jornada/Diagnóstico Inicial só deve ser liberada quando o aluno tiver pelo menos:

1. Anamnese concluída;
2. Pelo menos 2 provas oficiais ou simulados válidos inseridos;
3. Questões respondidas com acerto/erro registrados;
4. Classificação N1, N2 e N3 disponível nas questões consideradas;
5. Quantidade mínima de evidência suficiente para evitar conclusões frágeis.

Regra objetiva recomendada para liberar o botão **Iniciar Jornada**:

```ts
const elegivelParaJornada =
  anamneseConcluida &&
  provasOuSimuladosValidos >= 2 &&
  totalQuestoesValidas >= 80 &&
  totalErrosAnalisaveis >= 15 &&
  pctQuestoesComN1N2N3 >= 0.95;
```

Observação: a exigência de 2 provas oficiais/simulados é deliberadamente mais dura. O objetivo é impedir que o produto gere uma narrativa excessivamente confiante a partir de pouca evidência.

### 2.2 Antes da jornada, existe apenas relatório de prova

Antes de atingir os critérios de elegibilidade, o sistema pode exibir:

- relatório da prova;
- acertos e erros por disciplina;
- escopos com erro;
- metadados cognitivos preenchidos;
- sinais iniciais;
- mensagem de que ainda não há evidência suficiente para iniciar a jornada.

Linguagem sugerida:

> “Esta prova trouxe sinais importantes, mas ainda não há evidência suficiente para abrir sua Jornada. Insira mais uma prova ou simulado para que o diagnóstico inicial considere padrões recorrentes, não apenas um desempenho isolado.”

### 2.3 A jornada começa por ação explícita

Quando os critérios forem atendidos, deve aparecer o botão:

> **Iniciar Jornada**

Ao clicar, o sistema deve:

1. Gerar o Diagnóstico Inicial;
2. Fixar o baseline da jornada;
3. Criar o primeiro ciclo semanal;
4. Registrar a Semana 1;
5. Gerar a primeira proposta de foco semanal;
6. Criar as quests vinculadas ao ciclo.

O clique marca o início técnico e psicológico da jornada.

---

## 3. Conceitos fundamentais

### 3.1 Prova isolada

A prova isolada é uma unidade de evidência.

Ela responde:

> “Como o aluno foi nesta prova?”

Ela não deve responder sozinha:

> “Quem é este aluno pedagogicamente?”

Saídas permitidas:

- desempenho geral;
- acertos/erros;
- erros por N1/N2/N3;
- relatório da prova;
- padrões de erro observados nesta prova;
- recomendações provisórias.

### 3.2 Diagnóstico provisório

O diagnóstico provisório existe antes da jornada.

Ele usa linguagem cautelosa:

- “primeiros sinais”;
- “indícios”;
- “nesta prova”;
- “ainda não é possível afirmar recorrência”.

Não deve gerar narrativa longitudinal.

### 3.3 Diagnóstico inicial

O Diagnóstico Inicial é gerado quando a Jornada começa.

Ele é o marco zero do acompanhamento.

Deve registrar:

- quantidade de provas consideradas;
- quantidade de questões;
- quantidade de erros;
- bancas/tipos de prova;
- distribuição por N1;
- distribuição por N2;
- padrões de N3;
- padrões cognitivos;
- influência da anamnese;
- forças iniciais;
- fragilidades iniciais;
- riscos;
- prioridades.

O Diagnóstico Inicial não deve ser sobrescrito. Ele é um snapshot histórico.

### 3.4 Diagnóstico atual

O Diagnóstico Atual é o estado vivo da jornada.

Ele pode mudar quando entram novas evidências:

- nova prova completa;
- novo simulado completo;
- nova revisão de prova antiga;
- conclusão de ciclo semanal;
- mini-quiz de fechamento;
- quests realizadas;
- metadados cognitivos adicionais;
- novo registro emocional relevante.

Mas nem toda evidência tem o mesmo peso.

### 3.5 Jornada

A Jornada é a história longitudinal do aluno.

Ela deve mostrar:

- o ponto de partida;
- o foco de cada semana;
- o motivo da escolha do foco;
- o que foi feito;
- o que mudou;
- o que não mudou;
- o que retraiu;
- o que virou recorrente;
- o que foi consolidado;
- o que precisa ser monitorado.

A jornada não é uma sequência de planos soltos.

### 3.6 Ciclo semanal

O ciclo semanal é uma intervenção delimitada no tempo.

Ele deve ter:

- foco principal;
- justificativa diagnóstica;
- baseline do foco;
- quests associadas;
- eventual mini-quiz de fechamento;
- resultado local;
- narrativa de fechamento.

O ciclo semanal mede resposta à intervenção, mas não prova domínio definitivo.

---

## 4. Fontes de evidência do diagnóstico

O diagnóstico deve cruzar quatro camadas.

### 4.1 Camada pedagógica — N1, N2 e N3

A classificação da questão possui três níveis funcionais:

- N1: catálogo/disciplina diagnóstica;
- N2: escopo pedagógico;
- N3: conhecimento exigido específico.

Uso no diagnóstico:

- N1 orienta visão macro;
- N2 é a unidade principal de recorrência e priorização;
- N3 explica o detalhe fino do erro e ajuda a formular intervenção.

Regra central:

> O diagnóstico deve priorizar N2, não apenas disciplina.

Exemplo:

```json
{
  "n1": "quimica",
  "n2": "quim.solucoes.concentracao.massa_volume",
  "n3": "Calcular massa de soluto a partir de concentração em mg/L e volume da solução."
}
```

Erro genérico:

> “Aluno erra Química.”

Diagnóstico correto:

> “Aluno apresenta recorrência em concentração massa-volume, especialmente quando precisa converter volume e unidade de concentração.”

### 4.2 Camada cognitiva — metadados do erro

Metadados cognitivos individualizam o erro.

Dois alunos podem errar o mesmo N2 por motivos completamente diferentes.

Campos relevantes:

- tipoErro;
- observacaoAluno;
- confiancaNaResposta;
- percebeuErroDepois;
- estavaEntreAlternativas;
- motivoDaEscolha;
- etapaDoErro;
- estadoDuranteQuestao;
- tempoEstimado;
- revisaoAluno.

Esses dados devem modificar a interpretação do erro.

Exemplo:

Mesmo escopo:

```text
quim.solucoes.concentracao.massa_volume
```

Aluno A:

```text
tipoErro = CONCEITO_TEORICO
```

Interpretação:

> Falta compreensão do conceito de concentração.

Aluno B:

```text
tipoErro = CALCULO_BOBEIRA
```

Interpretação:

> O conceito pode estar presente, mas há falha operacional em unidades e contas.

Aluno C:

```text
tipoErro = INTERPRETACAO_ENUNCIADO
```

Interpretação:

> O aluno não localizou corretamente o dado pedido ou confundiu comando.

Aluno D:

```text
tipoErro = FALTA_TEMPO
```

Interpretação:

> O problema pode ser fluência/tempo, não necessariamente domínio conceitual.

### 4.3 Camada pessoal — anamnese

A anamnese não deve substituir a evidência de prova.

Ela deve modular:

- carga semanal;
- tom da narrativa;
- tipo de intervenção;
- ordem das prioridades;
- nível de cobrança;
- risco emocional;
- distribuição de tarefas;
- forma de feedback.

Exemplos:

Aluno com rotina de trabalho:

> plano com blocos menores e foco mais seletivo.

Aluno com ansiedade de prova:

> intervenção com treino gradual, mini-simulações e metacognição.

Aluno com histórico de trauma em Matemática:

> priorizar vitórias rápidas e controle de dificuldade antes de carga alta.

Aluno com meta FAMERP:

> ponderar mais provas e escopos recorrentes da banca-alvo.

Regra:

> Anamnese contextualiza, mas não inventa diagnóstico sem evidência.

### 4.4 Camada longitudinal — evolução e retração

A jornada precisa registrar mudança ao longo do tempo.

Não basta mostrar o estado atual.

O sistema deve conseguir dizer:

- melhorou;
- piorou;
- estabilizou;
- oscilou;
- consolidou;
- recaiu;
- permanece crítico;
- precisa de mais evidência.

Exemplo de narrativa correta:

> “Você reduziu erros em concentração massa-volume nas quests da semana, mas ainda não temos evidência de transferência para prova completa. O próximo simulado vai confirmar se essa melhora se sustenta sob pressão.”

---

## 5. Pesos de evidência

Nem toda evidência deve alterar o diagnóstico da mesma forma.

### 5.1 Evidência forte

Inclui:

- prova oficial;
- simulado completo;
- prova de banca-alvo;
- simulado cronometrado com estrutura realista.

Uso:

- atualiza diagnóstico global;
- confirma evolução ou recaída;
- pode mudar prioridades da jornada.

### 5.2 Evidência média

Inclui:

- mini-quiz de fechamento do ciclo;
- lista direcionada com 8 a 15 questões;
- bloco de treino com correção cognitiva.

Uso:

- mede resposta local à intervenção;
- altera status do escopo dentro do ciclo;
- não deve declarar domínio definitivo sozinho.

### 5.3 Evidência fraca/controlada

Inclui:

- quest curta;
- leitura de resumo;
- vídeo/aula concluída;
- flashcards;
- tarefa reflexiva;
- revisão guiada de erro.

Uso:

- mede aderência;
- prepara intervenção;
- gera sinais de comportamento;
- não deve alterar fortemente o diagnóstico global.

---

## 6. Regra de atualização do diagnóstico

### 6.1 Mudança real no Diagnóstico da Jornada

Para o MVP, uma mudança real do Diagnóstico da Jornada deve ocorrer principalmente após:

1. Inclusão de nova prova oficial ou simulado completo;
2. Fechamento de ciclo semanal com mini-quiz e/ou evidência de treino;
3. Combinação de novas evidências com histórico anterior.

Mas a interpretação deve ser diferente:

- nova prova/simulado completo pode alterar o diagnóstico global;
- mini-quiz altera o diagnóstico local do ciclo;
- quests alteram aderência, esforço e sinais fracos;
- metadados cognitivos refinam a explicação do erro.

Regra importante:

> A semana pode mostrar resposta à intervenção, mas a confirmação de impacto real no diagnóstico global exige nova prova ou simulado completo.

### 6.2 O papel do mini-quiz

O mini-quiz é uma boa forma de fechar a semana, mas deve ser interpretado corretamente.

Ele não prova que o aluno dominou o escopo em contexto real de prova.

Ele indica:

- se a intervenção local funcionou;
- se o aluno compreendeu melhor o foco da semana;
- se houve redução de erro em ambiente controlado;
- se o próximo ciclo deve manter, aprofundar ou trocar o foco.

Narrativa recomendada:

> “O mini-quiz indica melhora local no foco da semana. O próximo simulado dirá se essa melhora transferiu para prova completa.”

### 6.3 O papel das quests

Quests não devem alterar sozinhas o diagnóstico global.

Elas devem impactar:

- aderência;
- disciplina de estudo;
- exposição ao conteúdo;
- metacognição;
- prontidão para mini-quiz;
- confiança percebida.

Podem gerar sinais como:

- cumpriu;
- não cumpriu;
- cumpriu com dificuldade;
- pediu ajuda;
- marcou insegurança;
- repetiu erro cognitivo;
- melhorou autopercepção.

---

## 7. Estados por escopo

Cada escopo N2 relevante para o aluno deve poder assumir um estado.

Estados recomendados para o MVP:

```ts
type EstadoEscopoJornada =
  | "NAO_AVALIADO"
  | "SINAL_INICIAL"
  | "FRAGILIDADE"
  | "CRITICO"
  | "EM_INTERVENCAO"
  | "EM_RECUPERACAO"
  | "CONSOLIDADO"
  | "RECAIDA"
  | "MONITORAR";
```

### 7.1 NAO_AVALIADO

Não há evidência suficiente no escopo.

### 7.2 SINAL_INICIAL

Há erro ou acerto pontual, mas sem recorrência.

### 7.3 FRAGILIDADE

Há recorrência moderada de erro ou baixo desempenho em escopo relevante.

### 7.4 CRITICO

Há recorrência forte, peso alto para a meta ou erro repetido em provas diferentes.

### 7.5 EM_INTERVENCAO

O escopo foi escolhido como foco de ciclo semanal.

### 7.6 EM_RECUPERACAO

Houve melhora local em quests/mini-quiz, mas ainda falta confirmação em prova completa.

### 7.7 CONSOLIDADO

Houve melhora sustentada em prova/simulado posterior.

### 7.8 RECAIDA

Escopo que havia melhorado voltou a apresentar erro em prova/simulado completo.

### 7.9 MONITORAR

Escopo com evidência ambígua, oscilação ou baixa amostragem.

---

## 8. Critérios para priorização de foco

O foco da semana não deve ser escolhido apenas pelo maior número bruto de erros.

A priorização deve considerar:

1. Frequência do erro;
2. Recorrência em provas diferentes;
3. Peso da banca/meta do aluno;
4. Modo de uso da prova;
5. Gravidade pedagógica do escopo;
6. Pré-requisitos;
7. Tipo cognitivo do erro;
8. Possibilidade de ganho rápido;
9. Risco de acúmulo futuro;
10. Contexto da anamnese;
11. Estado emocional recente;
12. Proximidade com conteúdos recorrentes no vestibular-alvo.

Exemplo:

Escopo A:

```text
5 erros em prova antiga, baixa relação com a banca-alvo.
```

Escopo B:

```text
3 erros em duas provas recentes da banca-alvo, todos com metadado “confundi unidade”.
```

Prioridade provável:

```text
Escopo B.
```

---

## 9. Estrutura sugerida do Diagnóstico Inicial

O Diagnóstico Inicial deve ser estruturado, não apenas texto livre.

Formato conceitual:

```ts
type DiagnosticoInicialJornada = {
  versao: "1.0";
  criadoEm: string;
  evidencias: {
    provasValidas: number;
    questoesValidas: number;
    errosAnalisaveis: number;
    modosUso: Record<string, number>;
    bancas: Record<string, number>;
  };
  resumoExecutivo: string;
  forcas: DiagnosticoForca[];
  fragilidades: DiagnosticoFragilidade[];
  escoposCriticos: DiagnosticoEscopo[];
  padroesCognitivos: DiagnosticoPadraoCognitivo[];
  influenciaAnamnese: DiagnosticoAnamnese;
  riscos: DiagnosticoRisco[];
  prioridadesIniciais: PrioridadeDiagnostica[];
  limitesDaAnalise: string[];
};
```

### 9.1 Forças

Devem ser baseadas em acertos consistentes, não em ausência de erro.

Exemplo:

```text
Boa estabilidade em interpretação explícita de textos curtos.
```

### 9.2 Fragilidades

Devem indicar escopo e padrão.

Exemplo:

```text
Fragilidade em concentração massa-volume, especialmente quando a questão exige conversão de unidade.
```

### 9.3 Escopos críticos

Devem conter:

- escopoId;
- label;
- evidências;
- peso;
- status;
- motivo de prioridade.

### 9.4 Padrões cognitivos

Exemplos:

- erra por pressa;
- erra por interpretação;
- erra por cálculo operacional;
- sabe o conceito, mas não modela;
- chuta quando encontra texto longo;
- perde desempenho em questões com unidade;
- troca alternativa no final.

### 9.5 Influência da anamnese

Deve indicar como o contexto pessoal modula o plano, não diagnosticar sozinho.

### 9.6 Limites da análise

O diagnóstico deve ser honesto.

Exemplo:

```text
Ainda há pouca evidência em Física Moderna.
```

---

## 10. Estrutura sugerida do Diagnóstico Atual

O Diagnóstico Atual deve ser reprocessável e comparável ao baseline.

Formato conceitual:

```ts
type DiagnosticoAtualJornada = {
  versao: "1.0";
  atualizadoEm: string;
  desdeDiagnosticoInicial: {
    novasProvas: number;
    novasQuestoes: number;
    novosErros: number;
    ciclosConcluidos: number;
  };
  mudancasRelevantes: MudancaDiagnostica[];
  escopos: EstadoEscopo[];
  padroesCognitivosAtuais: DiagnosticoPadraoCognitivo[];
  alertas: DiagnosticoAlerta[];
  recomendacaoProximoCiclo: RecomendacaoCiclo;
};
```

### 10.1 Mudanças relevantes

Exemplos:

```text
Evoluiu em concentração massa-volume em treino controlado.
```

```text
Recaída em geometria plana após nova prova completa.
```

```text
Erro de interpretação tornou-se recorrente em questões de Humanas.
```

### 10.2 Alertas

Alertas devem chamar atenção para padrões que atravessam disciplinas.

Exemplos:

- falta de tempo;
- queda em questões longas;
- erro por unidade;
- baixa confiança mesmo em acertos;
- chute recorrente;
- oscilação emocional.

---

## 11. Relação entre prova, semana e diagnóstico

### 11.1 Nova prova ou simulado completo

Deve poder alterar:

- diagnóstico global;
- ranking de prioridades;
- estados por escopo;
- narrativa da jornada;
- recomendação do próximo ciclo.

### 11.2 Fechamento semanal

Deve alterar:

- resultado do ciclo;
- estado local do escopo em intervenção;
- narrativa de evolução local;
- confiança para avançar ou repetir foco.

Não deve declarar consolidação global sem evidência forte.

### 11.3 Quests

Devem alterar:

- aderência;
- esforço;
- exposição;
- metacognição;
- prontidão para mini-quiz.

Não devem sozinhas mudar o diagnóstico global.

---

## 12. Frases canônicas do produto

### 12.1 Antes da jornada

> “Ainda estamos coletando evidências. Esta prova trouxe sinais, mas a Jornada será liberada quando houver pelo menos duas provas ou simulados válidos.”

### 12.2 Ao iniciar jornada

> “Agora temos evidência suficiente para criar seu ponto de partida. Este diagnóstico inicial será o marco zero da sua Jornada.”

### 12.3 Após mini-quiz semanal

> “O mini-quiz mostra resposta local à intervenção desta semana. A próxima prova completa vai indicar se essa melhora se transferiu para situação real de prova.”

### 12.4 Após nova prova completa

> “Esta nova prova atualiza sua Jornada porque mede desempenho em contexto completo. Vamos comparar com o baseline e com o foco das últimas semanas.”

### 12.5 Quando há pouca evidência em um escopo

> “Ainda há pouca amostra para concluir domínio ou fragilidade neste escopo. Vamos monitorar.”

---

## 13. Regras negativas

O sistema não deve:

1. Gerar Jornada na primeira prova;
2. Chamar relatório de prova de Diagnóstico Inicial;
3. Usar somente maior número bruto de erros para definir foco;
4. Declarar domínio por quest concluída;
5. Declarar domínio global por mini-quiz isolado;
6. Ignorar metadados cognitivos;
7. Ignorar anamnese na carga e no tom do plano;
8. Sobrescrever o Diagnóstico Inicial;
9. Misturar disciplina oficial da prova com disciplina diagnóstica quando houver conflito;
10. Tratar toda evidência com o mesmo peso;
11. Transformar diagnóstico em lista de tarefas;
12. Transformar plano semanal em diagnóstico.

---

## 14. Integração com modelos existentes

### 14.1 QuestionAttempt

Fonte principal da evidência por questão.

Campos importantes:

- correto;
- respostaAluno;
- provaQuestaoId;
- conhecimentoDominioId;
- conhecimentoEscopoId;
- conhecimentoExigido;
- classificacaoConfianca;
- conceitosCanonicosJson;
- tipoErro;
- observacao;
- metadadosCognitivosJson.

### 14.2 StudentAnamnesis

Fonte de contexto pessoal.

Usar:

- structuredProfileJson;
- summary;
- completedAt;
- status.

### 14.3 DiagnosticSnapshot

No modelo atual, está vinculado a Exam.

Para a Jornada, será necessário decidir se:

1. será criado um novo tipo de snapshot global; ou
2. `DiagnosticSnapshot` será expandido para suportar snapshot de jornada; ou
3. será criado um modelo novo, por exemplo `JourneyDiagnosticSnapshot`.

Recomendação conceitual:

Criar um snapshot próprio da Jornada para não misturar diagnóstico de prova com diagnóstico longitudinal.

### 14.4 LearningCycle

Representa o ciclo semanal.

Campos úteis:

- metaEscopoId;
- metaDominioId;
- metaConceitosJson;
- metaCognitivaJson;
- baselineJson;
- resultadoJson;
- narrativaInicioJson;
- narrativaFimJson;
- storytellingJson.

Recomendação:

Usar `baselineJson` para registrar o estado do foco no início da semana e `resultadoJson` para registrar evidência local ao final.

### 14.5 Quest

Representa tarefas práticas.

Deve estar vinculada a:

- cicloId;
- conhecimentoEscopoId;
- fonteDiagnosticoJson;
- tipoQuest.

A quest deve saber por que existe.

### 14.6 StudyPlan

Representa plano semanal ou plano de prova.

No contexto da Jornada, deve ser consequência do diagnóstico e do ciclo, não fonte primária do diagnóstico.

---

## 15. Modelo conceitual recomendado para snapshot da Jornada

Modelo sugerido futuro:

```prisma
model JourneyDiagnosticSnapshot {
  id                String   @id @default(cuid())
  userId            String
  tipo              String   // INICIAL | ATUALIZACAO | FECHAMENTO_CICLO | POS_PROVA
  cicloId           String?
  examId            String?
  versao            String   @default("1.0")

  evidenciasJson    String   @db.Text
  diagnosticoJson   String   @db.Text
  mudancasJson      String?  @db.Text
  narrativaJson     String?  @db.Text

  createdAt         DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([tipo])
}
```

Esse modelo permite preservar histórico sem sobrescrever o marco inicial.

---

## 16. Algoritmo conceitual para elegibilidade da Jornada

```ts
type ElegibilidadeJornada = {
  elegivel: boolean;
  motivosBloqueio: string[];
  metricas: {
    anamneseConcluida: boolean;
    provasOuSimuladosValidos: number;
    totalQuestoesValidas: number;
    totalErrosAnalisaveis: number;
    pctQuestoesComN1N2N3: number;
  };
};
```

Critérios:

```ts
if (!anamneseConcluida) bloquear("Conclua sua anamnese inicial.");
if (provasOuSimuladosValidos < 2) bloquear("Insira pelo menos duas provas ou simulados válidos.");
if (totalQuestoesValidas < 80) bloquear("Ainda há poucas questões respondidas para iniciar a jornada.");
if (totalErrosAnalisaveis < 15) bloquear("Ainda há poucos erros analisáveis para gerar prioridades confiáveis.");
if (pctQuestoesComN1N2N3 < 0.95) bloquear("Algumas questões ainda não possuem classificação pedagógica completa.");
```

---

## 17. Algoritmo conceitual para Diagnóstico Inicial

1. Buscar provas/simulados válidos do aluno;
2. Filtrar registros elegíveis;
3. Agrupar tentativas por N2;
4. Agregar N3 dos erros;
5. Agregar metadados cognitivos;
6. Aplicar pesos por modo de uso, banca e meta;
7. Cruzar com anamnese;
8. Identificar forças;
9. Identificar fragilidades;
10. Identificar escopos críticos;
11. Identificar padrões cognitivos transversais;
12. Gerar prioridades iniciais;
13. Registrar limites da análise;
14. Criar snapshot inicial imutável;
15. Criar primeiro ciclo semanal.

---

## 18. Algoritmo conceitual para atualização após nova prova

1. Registrar nova prova/simulado;
2. Garantir N1/N2/N3 nas questões;
3. Registrar attempts;
4. Comparar novos dados com Diagnóstico Atual;
5. Verificar escopos do ciclo atual e ciclos recentes;
6. Identificar transferência ou não transferência;
7. Atualizar estados por escopo;
8. Registrar evolução, retração ou recaída;
9. Gerar snapshot POS_PROVA;
10. Sugerir próximo foco.

---

## 19. Algoritmo conceitual para fechamento semanal

1. Verificar quests concluídas;
2. Verificar metadados cognitivos preenchidos;
3. Rodar mini-quiz, se aplicável;
4. Comparar resultado local com baseline do ciclo;
5. Atualizar resultadoJson do ciclo;
6. Gerar narrativaFimJson;
7. Marcar escopo como EM_RECUPERACAO, MONITORAR, CRITICO ou manter EM_INTERVENCAO;
8. Não declarar CONSOLIDADO sem evidência forte posterior;
9. Criar snapshot FECHAMENTO_CICLO.

---

## 20. Critérios para evolução, retração e consolidação

### 20.1 Evolução local

Pode ser declarada após:

- quests concluídas;
- mini-quiz com melhora;
- redução de tipo de erro específico;
- maior confiança do aluno;
- melhor explicação própria.

Linguagem:

> “Houve melhora local.”

### 20.2 Evolução global

Só deve ser declarada após:

- nova prova completa;
- novo simulado completo;
- evidência forte posterior ao ciclo.

Linguagem:

> “A melhora apareceu também em situação de prova.”

### 20.3 Consolidação

Exige:

- acerto sustentado em evidência forte;
- ausência de recorrência recente;
- metadados cognitivos sem sinal de chute/insegurança forte.

### 20.4 Recaída

Ocorre quando:

- escopo anteriormente em recuperação/consolidado volta a ter erro em prova completa;
- erro cognitivo semelhante reaparece;
- desempenho cai sob pressão.

### 20.5 Retração

Ocorre quando:

- há piora em desempenho;
- aumento de erro em escopo antes estável;
- aumento de ansiedade/falta de tempo associado à queda.

---

## 21. Requisitos funcionais do MVP

### 21.1 Tela antes da Jornada

Deve mostrar:

- número de provas válidas;
- número de questões válidas;
- número de erros analisáveis;
- status da anamnese;
- progresso até liberar a jornada;
- relatórios de prova disponíveis.

### 21.2 Botão Iniciar Jornada

Só aparece quando elegível.

Ao clicar:

- cria Diagnóstico Inicial;
- cria baseline;
- cria LearningCycle Semana 1;
- gera foco inicial;
- gera plano/quests iniciais.

### 21.3 Tela da Jornada

Deve mostrar:

- Diagnóstico Inicial;
- Diagnóstico Atual;
- ciclo ativo;
- estados por escopo;
- evolução/retração;
- histórico de ciclos;
- últimas provas que alteraram o diagnóstico.

### 21.4 Pós-prova

Ao inserir nova prova completa após início da Jornada:

- atualizar diagnóstico;
- comparar com ciclos recentes;
- indicar transferência ou recaída;
- sugerir ajuste do próximo ciclo.

---

## 22. Limites do MVP

Para o MVP, não é necessário resolver tudo.

Prioridade:

1. Elegibilidade dura da Jornada;
2. Diagnóstico Inicial com baseline;
3. Estado por escopo;
4. Registro de ciclo semanal;
5. Fechamento semanal com mini-quiz como evidência local;
6. Atualização global apenas com nova prova/simulado completo;
7. Narrativa clara para o aluno.

Pode ficar para depois:

- modelo estatístico sofisticado;
- previsão de nota;
- recomendação adaptativa em tempo real;
- comparação com coorte;
- ranking por escopo;
- ajuste fino automatizado de carga semanal;
- pesos calibrados por histórico grande.

---

## 23. Critério de aceite conceitual

A implementação do diagnóstico/jornada estará correta se o sistema conseguir responder, para cada aluno:

1. Por que a Jornada ainda não foi liberada?
2. Quais evidências abriram a Jornada?
3. Qual foi o Diagnóstico Inicial?
4. Qual é o Diagnóstico Atual?
5. Qual escopo está crítico e por quê?
6. Qual escopo está em intervenção?
7. O que melhorou localmente na semana?
8. O que só será confirmado na próxima prova?
9. O que retraiu ou recaiu?
10. Como a anamnese modulou a intervenção?
11. Como os metadados cognitivos mudaram a leitura do erro?
12. Por que o próximo foco foi escolhido?

---

## 24. Conclusão

A Jornada deve transformar o Coach Vestibular em um motor longitudinal de aprendizagem.

O fluxo correto é:

```text
provas válidas + anamnese
→ elegibilidade
→ iniciar jornada
→ diagnóstico inicial
→ ciclo semanal
→ quests e mini-quiz
→ evidência local
→ nova prova/simulado
→ atualização global da jornada
```

A regra mais importante deste documento é:

> A semana pode mostrar resposta local; a prova ou simulado completo confirma impacto real no diagnóstico global.

Essa separação evita que o sistema confunda tarefa feita com aprendizagem consolidada, e impede que uma prova isolada gere uma narrativa diagnóstica prematura.
