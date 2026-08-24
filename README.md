# Meu Financeiro V8.7.0 — Formas de Pagamento / Liquidação

## Estado
ENTREGA PARA REVISÃO HUMANA. Não homologada.

## Diagnóstico
O modelo anterior tratava praticamente toda saída como movimento imediato de caixa e toda quitação de conta como pagamento financeiro integral. Isso não representava corretamente crédito, permuta ou liquidações mistas.

## Regra por forma
- Pix: impacto financeiro imediato.
- Débito: impacto financeiro imediato.
- Dinheiro: impacto financeiro imediato.
- Transferência: impacto financeiro imediato.
- Crédito: registra despesa econômica sem baixar o saldo e cria obrigação futura mínima.
- Compensação / Permuta: registra valor econômico sem entrada/saída bancária.
- Outro: nesta versão mantém comportamento financeiro imediato por compatibilidade.

## Obrigações
`conta_liquidacoes` permite múltiplas liquidações e pagamento parcial.
Uma obrigação pode ser liquidada por dinheiro, compensação ou, de forma mínima, transferida para obrigação futura no crédito.

## Orçamentos / recebimentos
`orcamento_recebimentos` passa a distinguir:
- valor financeiro (`impacta_caixa=true`);
- valor compensado (`impacta_caixa=false`).

O saldo do serviço considera ambos para liquidação.
O saldo bancário considera somente recebimento financeiro.

Exemplo:
R$ 2.000 = R$ 1.200 Pix + R$ 800 compensação:
- serviço liquidado: R$ 2.000;
- caixa: +R$ 1.200;
- compensação: R$ 800.

## Compensações entre partes
A tabela `compensacoes` mantém livro econômico separado por PF/CNPJ e contraparte.
- `credito_usuario`: valor a seu favor.
- `debito_usuario`: valor a favor da contraparte.
Saldo econômico nunca altera saldo bancário.

## Cartão de crédito
Implementado somente o essencial:
- compra econômica;
- obrigação futura;
- pagamento futuro reduz caixa.

Não existem fatura consolidada, limite, juros, parcelamento ou múltiplos cartões.

## Histórico
Movimentações antigas continuam válidas:
- `impacta_saldo` default true;
- forma de pagamento antiga pode permanecer nula;
- não há recálculo retroativo.

## Banco
Novas colunas:
- `movimentacoes.forma_liquidacao`
- `movimentacoes.impacta_saldo`
- `movimentacoes.contraparte`
- `movimentacoes.observacao`
- `movimentacoes.situacao`
- metadados em `contas`
- `orcamento_recebimentos.forma_liquidacao`
- `orcamento_recebimentos.impacta_caixa`
- contraparte/observação em recebimentos

Novas tabelas:
- `conta_liquidacoes`
- `compensacoes`

## Arquivos alterados
- index.html
- app.js
- styles.css
- README.md
- manifest.webmanifest
- supabase_v8_7_0_formas_liquidacao.sql

## Não executado
- commit
- push
- deploy
- publicação
- homologação
