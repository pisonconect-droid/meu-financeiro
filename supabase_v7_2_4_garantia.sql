-- MEU FINANCEIRO V7.2.4 — GARANTIA DE SERVIÇO
-- Execute uma vez no SQL Editor do Supabase.

alter table public.orcamentos
  add column if not exists concluido_em date,
  add column if not exists garantia_meses integer not null default 3,
  add column if not exists garantia_ate date;

-- Preenche garantia de orçamentos pagos antigos usando a data de pagamento
-- somente quando ainda não existe uma data de conclusão/garantia.
update public.orcamentos
set concluido_em = coalesce(concluido_em, pago_em::date),
    garantia_ate = coalesce(garantia_ate, (coalesce(concluido_em, pago_em::date) + interval '3 months')::date)
where status = 'pago'
  and pago_em is not null
  and garantia_ate is null;
