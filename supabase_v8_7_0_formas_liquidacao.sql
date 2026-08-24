-- =========================================================
-- MEU FINANCEIRO V8.7.0 — FORMAS DE PAGAMENTO / LIQUIDAÇÃO
-- REVISÃO HUMANA ANTES DE PUBLICAÇÃO
-- =========================================================

-- Movimentações existentes continuam impactando saldo por padrão.
alter table public.movimentacoes
  add column if not exists forma_liquidacao text,
  add column if not exists impacta_saldo boolean not null default true,
  add column if not exists contraparte text,
  add column if not exists observacao text,
  add column if not exists situacao text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='movimentacoes_forma_liquidacao_check') then
    alter table public.movimentacoes add constraint movimentacoes_forma_liquidacao_check
      check (forma_liquidacao is null or forma_liquidacao in ('pix','debito','credito','dinheiro','transferencia','compensacao','outro'));
  end if;
end $$;

-- Obrigações passam a ter metadados, sem alterar as antigas.
alter table public.contas
  add column if not exists categoria text,
  add column if not exists contraparte text,
  add column if not exists observacao text,
  add column if not exists forma_prevista text,
  add column if not exists origem text,
  add column if not exists referencia_id uuid;

-- Liquidações parciais de contas/obrigações.
create table if not exists public.conta_liquidacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete cascade,
  valor numeric(14,2) not null check (valor>0),
  data_liquidacao date not null,
  forma_liquidacao text not null check (forma_liquidacao in ('pix','debito','credito','dinheiro','transferencia','compensacao','outro')),
  impacta_saldo boolean not null default true,
  contraparte text,
  observacao text,
  created_at timestamptz not null default now()
);
alter table public.conta_liquidacoes enable row level security;
drop policy if exists "conta_liquidacoes_select_own" on public.conta_liquidacoes;
create policy "conta_liquidacoes_select_own" on public.conta_liquidacoes for select to authenticated using(auth.uid()=user_id);
drop policy if exists "conta_liquidacoes_insert_own" on public.conta_liquidacoes;
create policy "conta_liquidacoes_insert_own" on public.conta_liquidacoes for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "conta_liquidacoes_update_own" on public.conta_liquidacoes;
create policy "conta_liquidacoes_update_own" on public.conta_liquidacoes for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists conta_liquidacoes_conta_idx on public.conta_liquidacoes(conta_id);

-- Livro econômico de compensações. Não integra saldo PF/CNPJ.
create table if not exists public.compensacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta text not null check (conta in ('PF','CNPJ')),
  contraparte text not null,
  descricao text not null,
  valor numeric(14,2) not null check(valor>0),
  direcao text not null check(direcao in ('credito_usuario','debito_usuario')),
  data date not null,
  referencia_tipo text,
  referencia_id uuid,
  observacao text,
  created_at timestamptz not null default now()
);
alter table public.compensacoes enable row level security;
drop policy if exists "compensacoes_select_own" on public.compensacoes;
create policy "compensacoes_select_own" on public.compensacoes for select to authenticated using(auth.uid()=user_id);
drop policy if exists "compensacoes_insert_own" on public.compensacoes;
create policy "compensacoes_insert_own" on public.compensacoes for insert to authenticated with check(auth.uid()=user_id);
create index if not exists compensacoes_user_conta_idx on public.compensacoes(user_id,conta,contraparte);

-- Recebimentos de orçamento passam a distinguir caixa real e compensação.
alter table public.orcamento_recebimentos
  add column if not exists forma_liquidacao text,
  add column if not exists impacta_caixa boolean not null default true,
  add column if not exists contraparte text,
  add column if not exists observacao text;

update public.orcamento_recebimentos
set forma_liquidacao=case
  when lower(coalesce(forma_pagamento,'')) like '%pix%' then 'pix'
  when lower(coalesce(forma_pagamento,'')) like '%dinheiro%' then 'dinheiro'
  when lower(coalesce(forma_pagamento,'')) like '%transfer%' then 'transferencia'
  else 'outro'
end
where forma_liquidacao is null;

-- Histórico antigo permanece financeiro: impacto verdadeiro por default.
-- Não recalcula saldos nem cria movimentações.
