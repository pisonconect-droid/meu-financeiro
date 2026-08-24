-- =========================================================
-- MEU FINANCEIRO V8.8.0 — CARTÕES DE CRÉDITO E FATURAS
-- Execute UMA VEZ no SQL Editor.
-- =========================================================

create table if not exists public.cartoes_credito (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  conta text not null check (conta in ('PF','CNPJ')),
  dia_fechamento integer not null check (dia_fechamento between 1 and 31),
  dia_vencimento integer not null check (dia_vencimento between 1 and 31),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cartoes_credito enable row level security;
drop policy if exists "cartoes_select_own" on public.cartoes_credito;
create policy "cartoes_select_own" on public.cartoes_credito for select to authenticated using(auth.uid()=user_id);
drop policy if exists "cartoes_insert_own" on public.cartoes_credito;
create policy "cartoes_insert_own" on public.cartoes_credito for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "cartoes_update_own" on public.cartoes_credito;
create policy "cartoes_update_own" on public.cartoes_credito for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists cartoes_credito_user_conta_idx on public.cartoes_credito(user_id,conta);

create table if not exists public.cartao_faturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cartao_id uuid not null references public.cartoes_credito(id) on delete restrict,
  conta text not null check (conta in ('PF','CNPJ')),
  fechamento date not null,
  vencimento date not null,
  status text not null default 'aberta' check (status in ('aberta','quitada_antecipadamente','paga')),
  data_pagamento date,
  forma_pagamento text,
  valor_pago numeric(14,2),
  movimentacao_pagamento_id uuid references public.movimentacoes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cartao_id,vencimento)
);
alter table public.cartao_faturas enable row level security;
drop policy if exists "faturas_select_own" on public.cartao_faturas;
create policy "faturas_select_own" on public.cartao_faturas for select to authenticated using(auth.uid()=user_id);
drop policy if exists "faturas_insert_own" on public.cartao_faturas;
create policy "faturas_insert_own" on public.cartao_faturas for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "faturas_update_own" on public.cartao_faturas;
create policy "faturas_update_own" on public.cartao_faturas for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists cartao_faturas_user_conta_idx on public.cartao_faturas(user_id,conta,vencimento);

-- Compras novas no Crédito recebem vínculo explícito. Histórico antigo permanece intacto.
alter table public.movimentacoes
  add column if not exists cartao_id uuid references public.cartoes_credito(id) on delete set null,
  add column if not exists fatura_cartao_id uuid references public.cartao_faturas(id) on delete set null;
create index if not exists movimentacoes_fatura_cartao_idx on public.movimentacoes(fatura_cartao_id);

-- Não migrar automaticamente compras antigas no crédito.
-- Não criar faturas retroativas sem cartão/fechamento conhecidos.
-- Não recalcular saldos históricos.
