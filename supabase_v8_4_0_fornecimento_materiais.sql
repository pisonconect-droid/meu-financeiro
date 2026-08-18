-- =========================================================
-- MEU FINANCEIRO V8.4.0 — FORNECIMENTO DE MATERIAIS + ANTI-DUPLICIDADE
-- Execute UMA VEZ no SQL Editor.
-- =========================================================

alter table public.orcamento_itens
  add column if not exists fornecimento text not null default 'prestador';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orcamento_itens_fornecimento_check'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_fornecimento_check
      check (fornecimento in ('prestador','cliente'));
  end if;
end $$;

-- Fotos novas passam a guardar um hash para impedir duplicidade no mesmo orçamento.
alter table public.orcamento_fotos
  add column if not exists arquivo_hash text;

create unique index if not exists orcamento_fotos_orc_hash_unique
  on public.orcamento_fotos (orcamento_id, arquivo_hash)
  where arquivo_hash is not null;

-- Registros antigos permanecem como fornecimento do prestador por compatibilidade.
update public.orcamento_itens
set fornecimento='prestador'
where fornecimento is null;
