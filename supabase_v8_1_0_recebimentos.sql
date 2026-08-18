-- MEU FINANCEIRO V8.1.0 — RECEBIMENTOS / CONTAS A RECEBER
alter table public.orcamentos
  add column if not exists valor_recebido numeric(14,2) not null default 0,
  add column if not exists proximo_vencimento date;

create table if not exists public.orcamento_recebimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  valor numeric(14,2) not null check (valor > 0),
  data_recebimento date not null,
  forma_pagamento text,
  parcela text,
  created_at timestamptz not null default now()
);

alter table public.orcamento_recebimentos enable row level security;

drop policy if exists "recebimentos_select_own" on public.orcamento_recebimentos;
create policy "recebimentos_select_own" on public.orcamento_recebimentos for select to authenticated using (auth.uid()=user_id);
drop policy if exists "recebimentos_insert_own" on public.orcamento_recebimentos;
create policy "recebimentos_insert_own" on public.orcamento_recebimentos for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "recebimentos_update_own" on public.orcamento_recebimentos;
create policy "recebimentos_update_own" on public.orcamento_recebimentos for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "recebimentos_delete_own" on public.orcamento_recebimentos;
create policy "recebimentos_delete_own" on public.orcamento_recebimentos for delete to authenticated using (auth.uid()=user_id);

create index if not exists orcamento_recebimentos_orc_idx on public.orcamento_recebimentos(orcamento_id);
create index if not exists orcamento_recebimentos_user_idx on public.orcamento_recebimentos(user_id);

-- referência opcional para rastrear a entrada gerada por orçamento
alter table public.movimentacoes add column if not exists referencia_id uuid;
