# Wireframes — Coach Vestibular

Telas implementadas em `src/app/` com o mesmo fluxo descrito abaixo.

## 1. Registro de simulado (`/simulados/novo`)

```
+------------------------------------------+
|  Novo simulado                           |
|  Nome [________]  Data [____]  Banca [v] |
|  Total questões [90]  Nota opcional [__] |
+------------------------------------------+
|  Check-in: Como você está?  (1-5)      |
|  o o o o o                               |
+------------------------------------------+
|  Gabarito rápido:                        |
|  Q1 [Acertou][Errou] Matéria[v] Tema[v]  |
|  Tipo erro[v] se errou                   |
|  ... (lista scroll)                      |
|  [+ Adicionar em lote] [Importar CSV]    |
+------------------------------------------+
|  [Salvar e ver diagnóstico]              |
+------------------------------------------+
```

## 2. Dashboard (`/dashboard`)

```
+------------------------------------------+
|  Olá, {nome}          Streak: 3 dias     |
+------------------------------------------+
|  Último simulado: 62%  (+4% vs média)    |
|  [Gráfico evolução por matéria]          |
+------------------------------------------+
|  Fortes          |  Fracos              |
|  Biologia 78%    |  Química 45%         |
|  Português 72%   |  Física 52%          |
+------------------------------------------+
|  Diagnóstico em texto (template+regras)  |
|  Focos da semana: 1. Esteq. 2. Cin.    |
+------------------------------------------+
|  [Ver plano]  [Quests]  [Novo simulado]  |
+------------------------------------------+
```

## 3. Plano semanal (`/plano`)

```
+------------------------------------------+
|  Plano desta semana    [Modo recuperação]|
+------------------------------------------+
|  Foco 1: Estequiometria (base teórica)   |
|  - 20 questões + resumo de coeficientes  |
|  Foco 2: Cinemática                      |
|  Foco 3: 1 questão interpretação/dia     |
|  Meta transversal: revisar 2 simulados   |
+------------------------------------------+
|  [Gerar quests a partir do plano]        |
+------------------------------------------+
```

## 4. Quests + check-in (`/quests`)

```
+------------------------------------------+
|  Suas quests                             |
|  [x] 20 questões Estequiometria          |
|  [ ] Resumo Cinemática (30 min)          |
|  [ ] Check-in emocional pós-estudo       |
+------------------------------------------+
|  Ao concluir: mensagem de recompensa     |
|  "Você melhorou 12% em Biologia..."      |
+------------------------------------------+
```

## 5. Beta — convite (`/admin/convites`)

```
+------------------------------------------+
|  Códigos de convite (beta fechado)       |
|  MED2026-BETA [3 usos restantes]         |
|  [Gerar novo código]                     |
+------------------------------------------+
```

## 6. Fase 2 — Upload (`/simulados/upload`)

```
+------------------------------------------+
|  Enviar PDF/foto da prova (em breve IA)  |
|  [Arrastar arquivo]                      |
|  Status: extração assistida por IA       |
+------------------------------------------+
```
