-- =========================================================
-- MEU FINANCEIRO V8.0.3 — CONTAS FIXAS DE VALOR VARIÁVEL
-- Execute UMA VEZ no SQL Editor.
-- =========================================================

-- Conta recorrente: fixa ou variável.
alter table public.contas_fixas
  add column if not exists tipo_valor text not null default 'fixo',
  add column if not exists prioridade text not null default 'prioritaria';

alter table public.contas_fixas
  alter column valor drop not null;

-- Contas mensais variáveis precisam existir antes de o valor chegar.
alter table public.contas
  alter column valor drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contas_fixas_tipo_valor_check'
  ) then
    alter table public.contas_fixas
      add constraint contas_fixas_tipo_valor_check
      check (tipo_valor in ('fixo','variavel'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contas_fixas_prioridade_check'
  ) then
    alter table public.contas_fixas
      add constraint contas_fixas_prioridade_check
      check (prioridade in ('urgente','prioritaria','pode_esperar'));
  end if;
end $$;

-- Geração mensal: conta variável nasce com valor pendente (NULL).
create or replace function public.gerar_contas_fixas_mes(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_f record;
  v_vencimento date;
  v_ultimo_dia integer;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  v_ultimo_dia := extract(day from (
    date_trunc('month', p_competencia)::date
    + interval '1 month - 1 day'
  ))::integer;

  for v_f in
    select *
    from public.contas_fixas
    where user_id = v_uid
      and ativa = true
  loop
    v_vencimento :=
      date_trunc('month', p_competencia)::date
      + (least(v_f.dia_vencimento, v_ultimo_dia) - 1);

    if not exists (
      select 1
      from public.contas c
      where c.user_id = v_uid
        and c.conta = v_f.conta
        and c.descricao = v_f.descricao
        and date_trunc('month', c.vencimento) = date_trunc('month', p_competencia)
    ) then
      insert into public.contas (
        user_id,
        conta,
        descricao,
        valor,
        vencimento,
        status,
        prioridade
      )
      values (
        v_uid,
        v_f.conta,
        v_f.descricao,
        case when v_f.tipo_valor = 'variavel' then null else v_f.valor end,
        v_vencimento,
        'pendente',
        v_f.prioridade
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.gerar_contas_fixas_mes(date) from public;
grant execute on function public.gerar_contas_fixas_mes(date) to authenticated;
