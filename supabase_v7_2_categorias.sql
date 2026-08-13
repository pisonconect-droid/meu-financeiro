-- =========================================================
-- MEU FINANCEIRO V7.2 — CATEGORIAS PERSONALIZÁVEIS
-- Execute UMA VEZ no SQL Editor do Supabase.
-- A V7.1.3 / V7.1 já deve estar instalada.
-- =========================================================

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta text not null check (conta in ('PF','CNPJ')),
  nome text not null,
  protegida boolean not null default false,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categorias_user_conta_nome_uidx
on public.categorias(user_id,conta,nome);

alter table public.categorias enable row level security;

drop policy if exists "categorias_select_own" on public.categorias;
create policy "categorias_select_own"
on public.categorias
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "categorias_insert_own" on public.categorias;
create policy "categorias_insert_own"
on public.categorias
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "categorias_update_own" on public.categorias;
create policy "categorias_update_own"
on public.categorias
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "categorias_delete_own" on public.categorias;
create policy "categorias_delete_own"
on public.categorias
for delete
to authenticated
using (auth.uid() = user_id);

-- As categorias padrão são criadas automaticamente pelo aplicativo
-- na primeira abertura da V7.2, separadamente para PF e CNPJ.
--
-- Categorias protegidas pelo aplicativo:
-- Receita
-- Transferência
-- Peças / materiais (CNPJ)
-- Custos do serviço (CNPJ)
