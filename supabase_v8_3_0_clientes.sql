-- MEU FINANCEIRO V8.3.0 — CADASTRO DE CLIENTES
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  documento text,
  whatsapp text,
  email text,
  endereco text,
  created_at timestamptz not null default now()
);

alter table public.clientes enable row level security;

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes for select using (auth.uid() = user_id);
drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own" on public.clientes for insert with check (auth.uid() = user_id);
drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own" on public.clientes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own" on public.clientes for delete using (auth.uid() = user_id);

create index if not exists clientes_user_nome_idx on public.clientes(user_id, nome);

alter table public.orcamentos add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
create index if not exists orcamentos_cliente_id_idx on public.orcamentos(cliente_id);

-- Migração segura: cria cadastros a partir dos clientes já existentes nos orçamentos,
-- sem apagar nem alterar os textos atuais.
insert into public.clientes (user_id,nome,whatsapp)
select o.user_id, trim(o.cliente), max(nullif(trim(o.whatsapp),''))
from public.orcamentos o
where nullif(trim(o.cliente),'') is not null
and not exists (
  select 1 from public.clientes c
  where c.user_id=o.user_id and lower(trim(c.nome))=lower(trim(o.cliente))
)
group by o.user_id, trim(o.cliente);

update public.orcamentos o
set cliente_id=c.id
from public.clientes c
where o.cliente_id is null
  and c.user_id=o.user_id
  and lower(trim(c.nome))=lower(trim(o.cliente));
