# Meu Financeiro V7 — Categorias, Fotos e Custos em Andamento

## Novidades
- Categorias nos gastos e filtros no Dia a dia.
- Transferências, receitas, peças e custos de serviço são categorizados automaticamente.
- Fotos vinculadas ao orçamento usando Supabase Storage.
- Ao aprovar o orçamento, os custos reais já cadastrados entram imediatamente como gastos do CNPJ.
- Durante o serviço aprovado, o botão **+ Registrar custo** lança novos gastos no orçamento e no CNPJ ao mesmo tempo.
- Ao marcar como Pago, entra somente a receita do cliente. Os custos não são duplicados.
- Mantidas as correções da V6: Home PF | CNPJ | Orçamentos, calendário interno, edição de rascunho/enviado, privacidade e navegação persistente.

## Instalação
1. No Supabase SQL Editor, execute `supabase_v7_categorias_fotos.sql`.
2. Em Data API, exponha:
   - `aprovar_orcamento`
   - `registrar_custo_orcamento`
   - mantenha `marcar_orcamento_pago`, `transferir_valor`, `excluir_transferencia` e `recalcular_orcamento_pago` conforme já estavam.
3. Faça upload no GitHub de `index.html`, `app.js`, `styles.css`, `config.js` e `README.md`.
4. Aguarde o GitHub Pages e atualize o aplicativo.

## Regra financeira V7
- Rascunho/Enviado: custos são planejamento.
- Aprovado/Em andamento: custos reais passam a afetar o saldo CNPJ.
- Novo custo durante o serviço: afeta o CNPJ imediatamente.
- Pago: registra somente a receita.
