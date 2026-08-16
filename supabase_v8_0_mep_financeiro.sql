-- ============================================================
-- MEU FINANCEIRO V8.0 — MEP FINANCEIRO
-- Módulos por usuário + prioridade de contas + histórico seguro
-- Execute UMA VEZ no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.user_module_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pf_enabled boolean not null default true,
  cnpj_enabled boolean not null default false,
  orcamentos_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_module_preferences enable row level security;

drop policy if exists "module_preferences_select_own" on public.user_module_preferences;
create policy "module_preferences_select_own"
on public.user_module_preferences for select
using (auth.uid() = user_id);

drop policy if exists "module_preferences_insert_own" on public.user_module_preferences;
create policy "module_preferences_insert_own"
on public.user_module_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "module_preferences_update_own" on public.user_module_preferences;
create policy "module_preferences_update_own"
on public.user_module_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Prioridade para contas a pagar. Se a coluna já existir, nada é perdido.
alter table public.contas
  add column if not exists prioridade text not null default 'prioritaria';

-- Restringe os valores aceitos sem apagar dados existentes.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='contas_prioridade_check'
  ) then
    alter table public.contas
      add constraint contas_prioridade_check
      check (prioridade in ('urgente','prioritaria','pode_esperar'));
  end if;
end $$;

-- Preferências para usuários já existentes serão criadas quando salvarem os módulos.
