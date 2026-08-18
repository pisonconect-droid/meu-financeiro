-- MEU FINANCEIRO V8.2.0 — LEGENDA DAS FOTOS
-- Execute UMA VEZ.
alter table public.orcamento_fotos
  add column if not exists legenda text;

-- A coluna tipo já é usada pelo aplicativo para Antes/Depois.
-- A nova etapa usa o valor textual 'durante' na mesma coluna.
