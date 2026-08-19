-- MEU FINANCEIRO V8.6.1 — CORREÇÕES DE HOMOLOGAÇÃO

-- Reconciliar pagamentos históricos sem duplicar o caixa.
insert into public.orcamento_recebimentos
  (user_id,orcamento_id,valor,data_recebimento,forma_pagamento,parcela)
select
  o.user_id,o.id,
  coalesce(nullif(o.valor_recebido,0),o.total),
  coalesce(o.pago_em,o.data,current_date),
  coalesce(o.forma_pagamento_efetiva,o.forma_pagamento,'Não informado'),
  'Histórico reconciliado'
from public.orcamentos o
where o.status='pago'
  and coalesce(nullif(o.valor_recebido,0),o.total)>0
  and not exists (
    select 1 from public.orcamento_recebimentos r
    where r.orcamento_id=o.id
  );

-- Não insere nada em movimentacoes: o saldo não é duplicado.

update public.orcamentos
set concluido_em=coalesce(pago_em,data,current_date)
where status='pago' and concluido_em is null;
