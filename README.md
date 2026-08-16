# Meu Financeiro V8.0.3 — Valores BR + Contas Variáveis

## Alterações
- Campo monetário principal aceita vírgula e centavos no padrão brasileiro.
- Conta fixa pode ser:
  - **Valor fixo**: exige valor padrão.
  - **Valor variável**: não exige valor no cadastro.
- Conta variável gerada no mês aparece como **Valor pendente**.
- Para marcar conta variável como paga, primeiro é obrigatório informar o valor real.
- Prioridade da conta recorrente é preservada ao gerar o mês.
- Água, luz e similares podem ser cadastradas como recorrentes sem inventar valor.
- Restante da V8.0.2 preservado.

## Instalação
1. Execute `supabase_v8_0_3_valores_variaveis.sql`.
2. Não há tabela nova para expor no Data API.
3. Substitua no GitHub:
   - index.html
   - app.js
   - styles.css
   - config.js
   - README.md
4. Faça Ctrl+F5.
