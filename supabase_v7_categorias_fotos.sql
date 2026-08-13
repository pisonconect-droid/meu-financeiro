-- =========================================================
-- MEU FINANCEIRO — V7 CATEGORIAS + FOTOS + CUSTOS EM ANDAMENTO
-- Execute uma vez no SQL Editor do Supabase.
-- =========================================================

-- 1. Categorias
alter table public.movimentacoes add column if not exists categoria text;
alter table public.orcamento_custos add column if not exists categoria text;

update public.movimentacoes
set categoria = case
  when origem = 'transferencia' then 'Transferência'
  when origem = 'orcamento_pago' or tipo = 'entrada' then 'Receita'
  when origem = 'orcamento_custo_item' then 'Peças / materiais'
  when origem = 'orcamento_custo_servico' then 'Custos do serviço'
  else 'Despesas operacionais'
end
where categoria is null;

update public.orcamento_custos
set categoria='Custos do serviço'
where categoria is null;

-- 2. Fotos do orçamento
create table if not exists public.orcamento_fotos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  storage_path text not null unique,
  nome_arquivo text,
  created_at timestamptz not null default now()
);

alter table public.orcamento_fotos enable row level security;

drop policy if exists "orcamento_fotos_select_own" on public.orcamento_fotos;
create policy "orcamento_fotos_select_own" on public.orcamento_fotos for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "orcamento_fotos_insert_own" on public.orcamento_fotos;
create policy "orcamento_fotos_insert_own" on public.orcamento_fotos for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "orcamento_fotos_delete_own" on public.orcamento_fotos;
create policy "orcamento_fotos_delete_own" on public.orcamento_fotos for delete
to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id,name,public)
values ('orcamento-fotos','orcamento-fotos',false)
on conflict (id) do update set public=false;

drop policy if exists "orcamento_fotos_storage_select" on storage.objects;
create policy "orcamento_fotos_storage_select" on storage.objects for select
to authenticated using (
  bucket_id='orcamento-fotos' and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "orcamento_fotos_storage_insert" on storage.objects;
create policy "orcamento_fotos_storage_insert" on storage.objects for insert
to authenticated with check (
  bucket_id='orcamento-fotos' and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "orcamento_fotos_storage_delete" on storage.objects;
create policy "orcamento_fotos_storage_delete" on storage.objects for delete
to authenticated using (
  bucket_id='orcamento-fotos' and (storage.foldername(name))[1]=auth.uid()::text
);

-- 3. Aprovação: custos reais passam a afetar o CNPJ imediatamente.
create or replace function public.aprovar_orcamento(p_orcamento_id uuid,p_data date)
returns void language plpgsql security invoker set search_path=public as $$
declare
  v_uid uuid:=auth.uid();
  v_orc public.orcamentos%rowtype;
  v_item record;
  v_custo record;
begin
  if v_uid is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_orc from public.orcamentos
   where id=p_orcamento_id and user_id=v_uid and status in ('rascunho','enviado')
   for update;
  if not found then raise exception 'Orçamento não encontrado ou já aprovado'; end if;

  -- evita duplicidade se houver tentativa repetida
  delete from public.movimentacoes
   where user_id=v_uid and orcamento_id=p_orcamento_id
     and origem in ('orcamento_custo_item','orcamento_custo_servico');

  for v_item in select descricao,quantidade,custo_unitario
    from public.orcamento_itens
    where orcamento_id=p_orcamento_id and user_id=v_uid
      and tipo='peca' and custo_unitario>0
  loop
    insert into public.movimentacoes(user_id,conta,tipo,descricao,valor,data,origem,orcamento_id,categoria)
    values(v_uid,'CNPJ','saida','Custo: '||v_item.descricao,
      v_item.quantidade*v_item.custo_unitario,p_data,'orcamento_custo_item',p_orcamento_id,'Peças / materiais');
  end loop;

  for v_custo in select descricao,valor,coalesce(categoria,'Custos do serviço') categoria
    from public.orcamento_custos
    where orcamento_id=p_orcamento_id and user_id=v_uid and valor>0
  loop
    insert into public.movimentacoes(user_id,conta,tipo,descricao,valor,data,origem,orcamento_id,categoria)
    values(v_uid,'CNPJ','saida','Custo serviço: '||v_custo.descricao,
      v_custo.valor,p_data,'orcamento_custo_servico',p_orcamento_id,v_custo.categoria);
  end loop;

  update public.orcamentos set status='aprovado'
  where id=p_orcamento_id and user_id=v_uid;
end $$;

revoke all on function public.aprovar_orcamento(uuid,date) from public;
grant execute on function public.aprovar_orcamento(uuid,date) to authenticated;

-- 4. Novo custo durante serviço aprovado: grava no orçamento e no financeiro.
create or replace function public.registrar_custo_orcamento(
  p_orcamento_id uuid,p_descricao text,p_categoria text,p_valor numeric,p_data date
)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_uid uuid:=auth.uid();
  v_custo_id uuid;
  v_total numeric;
begin
  if v_uid is null then raise exception 'Usuário não autenticado'; end if;
  if p_valor<=0 then raise exception 'Valor inválido'; end if;
  if not exists(select 1 from public.orcamentos where id=p_orcamento_id and user_id=v_uid and status='aprovado')
    then raise exception 'O orçamento precisa estar aprovado/em andamento'; end if;

  insert into public.orcamento_custos(user_id,orcamento_id,descricao,valor,categoria)
  values(v_uid,p_orcamento_id,p_descricao,p_valor,coalesce(nullif(p_categoria,''),'Custos do serviço'))
  returning id into v_custo_id;

  insert into public.movimentacoes(user_id,conta,tipo,descricao,valor,data,origem,orcamento_id,categoria)
  values(v_uid,'CNPJ','saida','Custo serviço: '||p_descricao,p_valor,p_data,
    'orcamento_custo_servico',p_orcamento_id,coalesce(nullif(p_categoria,''),'Custos do serviço'));

  select coalesce(sum(valor),0) into v_total from public.orcamento_custos
   where orcamento_id=p_orcamento_id and user_id=v_uid;

  update public.orcamentos
  set custo_servico=v_total,
      resultado=total-coalesce(custo_itens,0)-v_total
  where id=p_orcamento_id and user_id=v_uid;

  return v_custo_id;
end $$;

revoke all on function public.registrar_custo_orcamento(uuid,text,text,numeric,date) from public;
grant execute on function public.registrar_custo_orcamento(uuid,text,text,numeric,date) to authenticated;

-- 5. Pagamento: agora registra SOMENTE a receita.
create or replace function public.marcar_orcamento_pago(p_orcamento_id uuid,p_data date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_uid uuid:=auth.uid();
  v_orc public.orcamentos%rowtype;
  v_receita uuid;
  v_custo_itens numeric(12,2):=0;
  v_custo_servico numeric(12,2):=0;
begin
  if v_uid is null then raise exception 'Usuário não autenticado'; end if;
  select * into v_orc from public.orcamentos
   where id=p_orcamento_id and user_id=v_uid and status='aprovado'
   for update;
  if not found then raise exception 'Somente orçamento aprovado pode ser marcado como pago'; end if;
  if v_orc.movimentacao_id is not null then raise exception 'Pagamento já registrado'; end if;

  select coalesce(sum(quantidade*custo_unitario),0) into v_custo_itens
  from public.orcamento_itens where orcamento_id=p_orcamento_id and user_id=v_uid and tipo='peca';

  select coalesce(sum(valor),0) into v_custo_servico
  from public.orcamento_custos where orcamento_id=p_orcamento_id and user_id=v_uid;

  insert into public.movimentacoes(user_id,conta,tipo,descricao,valor,data,origem,orcamento_id,categoria)
  values(v_uid,'CNPJ','entrada','Orçamento '||v_orc.numero||' - '||v_orc.cliente,
    v_orc.total,p_data,'orcamento_pago',p_orcamento_id,'Receita')
  returning id into v_receita;

  update public.orcamentos
  set status='pago',pago_em=p_data,movimentacao_id=v_receita,
      custo_itens=v_custo_itens,custo_servico=v_custo_servico,
      resultado=total-v_custo_itens-v_custo_servico
  where id=p_orcamento_id and user_id=v_uid;

  return v_receita;
end $$;

revoke all on function public.marcar_orcamento_pago(uuid,date) from public;
grant execute on function public.marcar_orcamento_pago(uuid,date) to authenticated;
