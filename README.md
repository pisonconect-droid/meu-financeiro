# Meu Financeiro V8.9.8 — Conciliação Bancária PF · Nubank

**Escopo exclusivo PF.** CNPJ e Orçamentos não recebem mudança de regra.

Fonte de verdade:
- 01/08/2026 a 24/08/2026
- Saldo inicial R$ 4,34
- Entradas R$ 3.159,00
- Saídas R$ 3.105,38
- Saldo final R$ 57,96

A conciliação fica em tabelas próprias no Supabase e não apaga/regrava `movimentacoes`.
Quando há conciliação fechada, o saldo PF parte de R$ 57,96 e soma somente movimentos posteriores a 24/08.

Separações visíveis:
- receitas reais
- despesas reais
- transferências próprias
- transferências de terceiros
- pagamentos de fatura
- a classificar

R$ 3.009,00 de transferências próprias afetam banco, mas não receita.
R$ 150,00 de terceiros permanecem pendentes de classificação econômica.
R$ 468,33 de pagamento de fatura afetam banco sem duplicar despesa de consumo.
R$ 133,40 permanecem `A classificar`.

Ordem:
1. executar `supabase_v8_9_8_conciliacao_pf_nubank.sql`;
2. atualizar arquivos do GitHub;
3. em PF, importar `conciliacao_pf_nubank_2026-08.csv`;
4. validar saldo R$ 57,96.

Sem commit, push, deploy ou homologação automáticos.
