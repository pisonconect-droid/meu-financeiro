-- MEU FINANCEIRO V8.9.8 — CONCILIAÇÃO BANCÁRIA
create extension if not exists pgcrypto;

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta text not null check (conta in ('PF','CNPJ')),
  banco text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  saldo_inicial numeric(14,2) not null default 0,
  total_entradas numeric(14,2) not null default 0,
  total_saidas numeric(14,2) not null default 0,
  saldo_final numeric(14,2) not null default 0,
  status text not null default 'conciliado' check (status in ('rascunho','conciliado')),
  fonte text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,conta,banco,periodo_inicio,periodo_fim)
);

create table if not exists public.bank_reconciliation_entries (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.bank_reconciliations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conta text not null check (conta in ('PF','CNPJ')),
  banco text not null,
  data date not null,
  direcao text not null check (direcao in ('entrada','saida')),
  valor numeric(14,2) not null check (valor >= 0),
  contraparte text,
  descricao text,
  classificacao text not null check (classificacao in ('receita','despesa','transferencia_propria','transferencia_terceiro','pagamento_fatura','estorno_reembolso','a_classificar','teste')),
  categoria_sugerida text,
  classificacao_confirmada boolean not null default false,
  impacta_saldo boolean not null default true,
  observacao text,
  source_key text,
  created_at timestamptz not null default now(),
  unique(user_id,reconciliation_id,source_key)
);

alter table public.bank_reconciliations enable row level security;
alter table public.bank_reconciliation_entries enable row level security;

drop policy if exists bank_reconciliations_select_own on public.bank_reconciliations;
create policy bank_reconciliations_select_own on public.bank_reconciliations for select to authenticated using(auth.uid()=user_id);
drop policy if exists bank_reconciliations_insert_own on public.bank_reconciliations;
create policy bank_reconciliations_insert_own on public.bank_reconciliations for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists bank_reconciliations_update_own on public.bank_reconciliations;
create policy bank_reconciliations_update_own on public.bank_reconciliations for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists bank_reconciliation_entries_select_own on public.bank_reconciliation_entries;
create policy bank_reconciliation_entries_select_own on public.bank_reconciliation_entries for select to authenticated using(auth.uid()=user_id);
drop policy if exists bank_reconciliation_entries_insert_own on public.bank_reconciliation_entries;
create policy bank_reconciliation_entries_insert_own on public.bank_reconciliation_entries for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists bank_reconciliation_entries_delete_own on public.bank_reconciliation_entries;
create policy bank_reconciliation_entries_delete_own on public.bank_reconciliation_entries for delete to authenticated using(auth.uid()=user_id);

create index if not exists bank_reconciliations_user_conta_idx on public.bank_reconciliations(user_id,conta,periodo_fim desc);
create index if not exists bank_reconciliation_entries_reconciliation_idx on public.bank_reconciliation_entries(reconciliation_id,data);
