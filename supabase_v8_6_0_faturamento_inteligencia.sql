-- =========================================================
-- MEU FINANCEIRO V8.6.0
-- FATURAMENTO ACOMPANHADO + SITUAÇÃO FISCAL + INTELIGÊNCIA
-- Execute UMA VEZ.
-- =========================================================

-- 1) Tipo de cliente: necessário para oferecer dispensa fiscal somente a PF.
alter table public.clientes
  add column if not exists tipo_cliente text not null default 'nao_informado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='clientes_tipo_cliente_check'
  ) then
    alter table public.clientes
      add constraint clientes_tipo_cliente_check
      check (tipo_cliente in ('pf','pj','nao_informado'));
  end if;
end $$;

-- Migração conservadora quando já existe CPF/CNPJ reconhecível.
update public.clientes
set tipo_cliente=case
  when length(regexp_replace(coalesce(documento,''),'\D','','g'))=11 then 'pf'
  when length(regexp_replace(coalesce(documento,''),'\D','','g'))=14 then 'pj'
  else tipo_cliente
end
where tipo_cliente='nao_informado';

-- 2) Situação fiscal do serviço é separada do status operacional/financeiro.
alter table public.orcamentos
  add column if not exists situacao_fiscal text not null default 'pendente';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='orcamentos_situacao_fiscal_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_situacao_fiscal_check
      check (situacao_fiscal in ('pendente','nfse_emitida','dispensada_pf'));
  end if;
end $$;

-- NFS-e já registrada continua reconhecida como emitida.
update public.orcamentos o
set situacao_fiscal='nfse_emitida'
where exists (
  select 1 from public.orcamento_nfse n where n.orcamento_id=o.id
);

-- 3) Limite anual é CONFIGURADO pelo usuário; nenhum limite legal é hard-coded.
alter table public.profiles
  add column if not exists mei_limite_anual numeric(14,2);

-- Nenhuma alteração em movimentações, saldo ou recebimentos.
-- Faturamento acompanhado é calculado a partir de orcamento_recebimentos.
