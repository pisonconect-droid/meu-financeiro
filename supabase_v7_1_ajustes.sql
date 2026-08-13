-- =========================================================
-- MEU FINANCEIRO V7.1 — AJUSTES
-- 1) Fotos Antes/Depois
-- 2) Permite ressincronizar custos de orçamento já Aprovado
-- Execute UMA VEZ no SQL Editor.
-- =========================================================

alter table public.orcamento_fotos
add column if not exists tipo text not null default 'antes';

alter table public.orcamento_fotos
drop constraint if exists orcamento_fotos_tipo_check;

alter table public.orcamento_fotos
add constraint orcamento_fotos_tipo_check
check (tipo in ('antes','depois'));

create or replace function public.aprovar_orcamento(
  p_orcamento_id uuid,
  p_data date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_orc public.orcamentos%rowtype;
  v_item record;
  v_custo record;
  v_data_custos date;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
    into v_orc
    from public.orcamentos
   where id = p_orcamento_id
     and user_id = v_uid
     and status in ('rascunho','enviado','aprovado')
   for update;

  if not found then
    raise exception 'Orçamento não encontrado ou não pode ser atualizado';
  end if;

  -- Se já estava aprovado, mantém a data dos custos já lançados.
  select min(data)
    into v_data_custos
    from public.movimentacoes
   where user_id = v_uid
     and orcamento_id = p_orcamento_id
     and origem in ('orcamento_custo_item','orcamento_custo_servico');

  v_data_custos := coalesce(v_data_custos, p_data);

  delete from public.movimentacoes
   where user_id = v_uid
     and orcamento_id = p_orcamento_id
     and origem in ('orcamento_custo_item','orcamento_custo_servico');

  for v_item in
    select descricao, quantidade, custo_unitario
      from public.orcamento_itens
     where orcamento_id = p_orcamento_id
       and user_id = v_uid
       and tipo = 'peca'
       and custo_unitario > 0
  loop
    insert into public.movimentacoes
      (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id, categoria)
    values
      (v_uid, 'CNPJ', 'saida',
       'Custo: ' || v_item.descricao,
       v_item.quantidade * v_item.custo_unitario,
       v_data_custos, 'orcamento_custo_item', p_orcamento_id, 'Peças / materiais');
  end loop;

  for v_custo in
    select descricao, valor, coalesce(categoria,'Custos do serviço') categoria
      from public.orcamento_custos
     where orcamento_id = p_orcamento_id
       and user_id = v_uid
       and valor > 0
  loop
    insert into public.movimentacoes
      (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id, categoria)
    values
      (v_uid, 'CNPJ', 'saida',
       'Custo serviço: ' || v_custo.descricao,
       v_custo.valor,
       v_data_custos, 'orcamento_custo_servico', p_orcamento_id, v_custo.categoria);
  end loop;

  update public.orcamentos
     set status = 'aprovado',
         custo_itens = (
           select coalesce(sum(quantidade*custo_unitario),0)
             from public.orcamento_itens
            where orcamento_id=p_orcamento_id
              and user_id=v_uid
              and tipo='peca'
         ),
         custo_servico = (
           select coalesce(sum(valor),0)
             from public.orcamento_custos
            where orcamento_id=p_orcamento_id
              and user_id=v_uid
         ),
         resultado = total
           - (
               select coalesce(sum(quantidade*custo_unitario),0)
                 from public.orcamento_itens
                where orcamento_id=p_orcamento_id
                  and user_id=v_uid
                  and tipo='peca'
             )
           - (
               select coalesce(sum(valor),0)
                 from public.orcamento_custos
                where orcamento_id=p_orcamento_id
                  and user_id=v_uid
             )
   where id = p_orcamento_id
     and user_id = v_uid;
end;
$$;

revoke all on function public.aprovar_orcamento(uuid,date) from public;
grant execute on function public.aprovar_orcamento(uuid,date) to authenticated;
