-- =========================================================
-- MEU FINANCEIRO V8.5.0 — NFS-e / DANFSe
-- Execute UMA VEZ no SQL Editor do Supabase.
-- =========================================================

create table if not exists public.orcamento_nfse (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  numero text not null,
  data_emissao date not null,
  valor numeric(14,2) not null check (valor > 0),
  data_prevista_pagamento date,
  pdf_path text not null,
  pdf_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (orcamento_id)
);

alter table public.orcamento_nfse enable row level security;

drop policy if exists "nfse_select_own" on public.orcamento_nfse;
create policy "nfse_select_own" on public.orcamento_nfse
  for select to authenticated using (auth.uid()=user_id);

drop policy if exists "nfse_insert_own" on public.orcamento_nfse;
create policy "nfse_insert_own" on public.orcamento_nfse
  for insert to authenticated with check (auth.uid()=user_id);

drop policy if exists "nfse_update_own" on public.orcamento_nfse;
create policy "nfse_update_own" on public.orcamento_nfse
  for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create index if not exists orcamento_nfse_user_idx on public.orcamento_nfse(user_id);
create index if not exists orcamento_nfse_orc_idx on public.orcamento_nfse(orcamento_id);

-- Bucket privado para documentos fiscais.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('orcamento-documentos','orcamento-documentos',false,10485760,array['application/pdf'])
on conflict (id) do update
set public=false,
    file_size_limit=10485760,
    allowed_mime_types=array['application/pdf'];

-- Cada arquivo fica em: user_id/orcamento_id/danfse.pdf
drop policy if exists "documentos_select_own" on storage.objects;
create policy "documentos_select_own" on storage.objects
for select to authenticated
using (
  bucket_id='orcamento-documentos'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "documentos_insert_own" on storage.objects;
create policy "documentos_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id='orcamento-documentos'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "documentos_update_own" on storage.objects;
create policy "documentos_update_own" on storage.objects
for update to authenticated
using (
  bucket_id='orcamento-documentos'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='orcamento-documentos'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- Não há ação de exclusão da NFS-e no aplicativo.
-- A substituição usa o mesmo caminho com upsert=true.
