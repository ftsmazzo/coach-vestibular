# Validação com simulado real

Use este guia com a estudante após um simulado real do cursinho.

## Passo a passo

1. Baixe o template: [simulado-validacao.csv](./templates/simulado-validacao.csv)
2. Para cada questão, preencha:
   - `numero_questao`: número na prova
   - `acertou`: `true` ou `false`
   - `materia_sugerida` e `tema_sugerido`: use a taxonomia do app ou deixe em branco para classificar depois
   - `tipo_erro` (só se errou): `base_teorica`, `interpretacao`, `atencao`, `tempo`
   - `observacao`: opcional, em linguagem dela
3. Importe no app em **Simulados → Importar CSV** ou registre manualmente na tela de gabarito.
4. Compare o diagnóstico gerado com a percepção dela: “faz sentido?”

## Exemplo incluído

O arquivo `data/exemplo-simulado.json` modela um simulado de 10 questões com padrão típico (Estequiometria e Cinemática como focos).

## Checklist de validação

- [ ] Os 3 temas com mais erro batem com o que ela sente?
- [ ] A mensagem do diagnóstico soa acolhedora, não punitiva?
- [ ] O plano semanal tem no máximo 3 focos?
- [ ] Após simulado ruim, o modo recuperação aparece?
