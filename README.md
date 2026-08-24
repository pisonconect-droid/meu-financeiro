# Meu Financeiro V8.8.0 — Cartões de Crédito e Faturas

## Estado
ENTREGA PARA REVISÃO HUMANA. Não homologada.

## Estrutura criada
### Cartões
- Nome/apelido
- PF ou CNPJ
- Dia de fechamento
- Dia de vencimento
- Ativo/inativo

### Faturas
- Cartão
- Fechamento
- Vencimento
- Estado: aberta / quitada antecipadamente / paga
- Data e forma de pagamento
- Vínculo com a saída financeira do pagamento

## Regra de ciclo
A data da compra é comparada ao fechamento do cartão.
- Compra até o fechamento: pertence ao ciclo que fecha naquele mês.
- Compra após o fechamento: pertence ao ciclo seguinte.
- O vencimento é a primeira data configurada que ocorre depois do fechamento.
- Dias inexistentes (29/30/31) usam o último dia válido do mês.
- Cálculo usa datas civis locais, sem UTC.

## Compra no Crédito
- registra gasto econômico;
- `impacta_saldo=false`;
- exige selecionar cartão;
- calcula fatura automaticamente;
- não cria nova conta comum em `contas`;
- a compra aparece individualmente no histórico com cartão e fatura.

## Bloco Cartões de crédito
As faturas ficam separadas de Urgentes / Prioritárias / Podem esperar.
A fatura mostra total, quantidade de compras, vencimento e situação.
`Ver compras` abre sua composição.

## Pagamento da fatura
- uma única saída bancária pelo total da fatura;
- compras não geram nova saída;
- pagamento antes do vencimento = `Quitada antecipadamente`;
- pagamento no vencimento ou depois = `Paga`;
- não existe pagamento parcial nesta MEP.

## Total a pagar
Soma contas comuns abertas + faturas abertas.
As compras da fatura não são somadas novamente como obrigações.

## Histórico anterior
Compras no Crédito já existentes continuam exatamente como estavam.
Nenhuma associação a cartão/fatura é inventada.
Nenhum saldo histórico é recalculado.

## Banco
Novas tabelas:
- `cartoes_credito`
- `cartao_faturas`

Novas referências em `movimentacoes`:
- `cartao_id`
- `fatura_cartao_id`

## Arquivos alterados
- index.html
- app.js
- styles.css
- README.md
- manifest.webmanifest
- supabase_v8_8_0_cartoes_faturas.sql

## Não executado
- commit
- push
- deploy
- publicação
- homologação
