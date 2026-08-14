-- =========================================================
-- MEU FINANCEIRO V7.2.5 — FORMA / CONDIÇÃO DE PAGAMENTO
-- Execute UMA VEZ no SQL Editor.
-- =========================================================

alter table public.orcamentos
  add column if not exists forma_pagamento text,
  add column if not exists condicao_pagamento text,
  add column if not exists condicao_pagamento_detalhe text,
  add column if not exists forma_pagamento_efetiva text;

-- Valores padrão apenas para registros antigos ainda sem informação.
update public.orcamentos
set forma_pagamento='PIX'
where forma_pagamento is null;

update public.orcamentos
set condicao_pagamento='À vista'
where condicao_pagamento is null;
