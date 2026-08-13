-- =========================================================
-- MEU FINANCEIRO — V6 CORREÇÃO FINAL
-- Execute UMA VEZ no SQL Editor do Supabase antes do deploy.
-- =========================================================

-- 1) Status profissional dos orçamentos
alter table public.orcamentos
drop constraint if exists orcamentos_status_check;

update public.orcamentos
set status = 'rascunho'
where status = 'orcamento';

alter table public.orcamentos
add constraint orcamentos_status_check
check (status in ('rascunho','enviado','aprovado','pago'));

alter table public.orcamentos
alter column status set default 'rascunho';

-- 2) Corrige a regra financeira:
--    M.O. cobrada NÃO é custo.
--    Apenas itens do tipo 'peca' usam custo_unitario como custo real.
create or replace function public.marcar_orcamento_pago(
  p_orcamento_id uuid,
  p_data date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_orc public.orcamentos%rowtype;
  v_mov_receita uuid;
  v_custo_itens numeric(12,2) := 0;
  v_custo_servico numeric(12,2) := 0;
  v_resultado numeric(12,2) := 0;
  v_item record;
  v_custo record;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
    into v_orc
    from public.orcamentos
   where id = p_orcamento_id
     and user_id = v_user_id
   for update;

  if not found then
    raise exception 'Orçamento não encontrado';
  end if;

  if v_orc.status <> 'aprovado' then
    raise exception 'Somente orçamento aprovado pode ser marcado como pago';
  end if;

  if v_orc.movimentacao_id is not null then
    raise exception 'Pagamento já registrado';
  end if;

  select coalesce(sum(quantidade * custo_unitario),0)
    into v_custo_itens
    from public.orcamento_itens
   where orcamento_id = p_orcamento_id
     and user_id = v_user_id
     and tipo = 'peca';

  select coalesce(sum(valor),0)
    into v_custo_servico
    from public.orcamento_custos
   where orcamento_id = p_orcamento_id
     and user_id = v_user_id;

  v_resultado := v_orc.total - v_custo_itens - v_custo_servico;

  insert into public.movimentacoes
    (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id)
  values
    (v_user_id, 'CNPJ', 'entrada',
     'Orçamento ' || v_orc.numero || ' - ' || v_orc.cliente,
     v_orc.total, p_data, 'orcamento_pago', p_orcamento_id)
  returning id into v_mov_receita;

  for v_item in
    select descricao, quantidade, custo_unitario
      from public.orcamento_itens
     where orcamento_id = p_orcamento_id
       and user_id = v_user_id
       and tipo = 'peca'
       and custo_unitario > 0
  loop
    insert into public.movimentacoes
      (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id)
    values
      (v_user_id, 'CNPJ', 'saida',
       'Custo: ' || v_item.descricao,
       v_item.quantidade * v_item.custo_unitario,
       p_data, 'orcamento_custo_item', p_orcamento_id);
  end loop;

  for v_custo in
    select descricao, valor
      from public.orcamento_custos
     where orcamento_id = p_orcamento_id
       and user_id = v_user_id
       and valor > 0
  loop
    insert into public.movimentacoes
      (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id)
    values
      (v_user_id, 'CNPJ', 'saida',
       'Custo serviço: ' || v_custo.descricao,
       v_custo.valor,
       p_data, 'orcamento_custo_servico', p_orcamento_id);
  end loop;

  update public.orcamentos
     set status = 'pago',
         pago_em = p_data,
         movimentacao_id = v_mov_receita,
         custo_itens = v_custo_itens,
         custo_servico = v_custo_servico,
         resultado = v_resultado
   where id = p_orcamento_id
     and user_id = v_user_id;

  return v_mov_receita;
end;
$$;

-- 3) Função para corrigir orçamento JÁ pago com a regra antiga.
--    Ela apaga somente os lançamentos automáticos ligados ao orçamento
--    e os recria com a regra correta, preservando os demais lançamentos.
create or replace function public.recalcular_orcamento_pago(
  p_orcamento_id uuid
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_orc public.orcamentos%rowtype;
  v_data date;
  v_receita uuid;
  v_custo_itens numeric(12,2) := 0;
  v_custo_servico numeric(12,2) := 0;
  v_resultado numeric(12,2) := 0;
  v_item record;
  v_custo record;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
    into v_orc
    from public.orcamentos
   where id = p_orcamento_id
     and user_id = v_user_id
     and status = 'pago'
   for update;

  if not found then
    raise exception 'Orçamento pago não encontrado';
  end if;

  v_data := coalesce(v_orc.pago_em, current_date);

  delete from public.movimentacoes
   where user_id = v_user_id
     and orcamento_id = p_orcamento_id
     and origem in ('orcamento_pago','orcamento_custo_item','orcamento_custo_servico');

  select coalesce(sum(quantidade * custo_unitario),0)
    into v_custo_itens
    from public.orcamento_itens
   where orcamento_id = p_orcamento_id
     and user_id = v_user_id
     and tipo = 'peca';

  select coalesce(sum(valor),0)
    into v_custo_servico
    from public.orcamento_custos
   where orcamento_id = p_orcamento_id
     and user_id = v_user_id;

  v_resultado := v_orc.total - v_custo_itens - v_custo_servico;

  insert into public.movimentacoes
    (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id)
  values
    (v_user_id, 'CNPJ', 'entrada',
     'Orçamento ' || v_orc.numero || ' - ' || v_orc.cliente,
     v_orc.total, v_data, 'orcamento_pago', p_orcamento_id)
  returning id into v_receita;

  for v_item in
    select descricao, quantidade, custo_unitario
      from public.orcamento_itens
     where orcamento_id = p_orcamento_id
       and user_id = v_user_id
       and tipo = 'peca'
       and custo_unitario > 0
  loop
    insert into public.movimentacoes
      (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id)
    values
      (v_user_id, 'CNPJ', 'saida',
       'Custo: ' || v_item.descricao,
       v_item.quantidade * v_item.custo_unitario,
       v_data, 'orcamento_custo_item', p_orcamento_id);
  end loop;

  for v_custo in
    select descricao, valor
      from public.orcamento_custos
     where orcamento_id = p_orcamento_id
       and user_id = v_user_id
       and valor > 0
  loop
    insert into public.movimentacoes
      (user_id, conta, tipo, descricao, valor, data, origem, orcamento_id)
    values
      (v_user_id, 'CNPJ', 'saida',
       'Custo serviço: ' || v_custo.descricao,
       v_custo.valor,
       v_data, 'orcamento_custo_servico', p_orcamento_id);
  end loop;

  update public.orcamentos
     set movimentacao_id = v_receita,
         custo_itens = v_custo_itens,
         custo_servico = v_custo_servico,
         resultado = v_resultado
   where id = p_orcamento_id
     and user_id = v_user_id;

  return v_resultado;
end;
$$;

revoke all on function public.recalcular_orcamento_pago(uuid) from public;
grant execute on function public.recalcular_orcamento_pago(uuid) to authenticated;
