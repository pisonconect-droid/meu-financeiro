# Meu Financeiro V8.0 — MEP Financeiro

## Escopo congelado implementado
- Preferências de módulos por usuário: PF, CNPJ e Orçamentos.
- Orçamentos dependem de CNPJ.
- Home preparada para módulos mais compactos.
- Lançamentos financeiros confirmados deixam de ser excluídos.
- Categorias continuam acessíveis sob demanda.
- Contas a pagar preparadas para prioridade: Urgente, Prioritária, Pode esperar.
- Contas fixas preservadas.
- Resumo financeiro em acesso próprio.
- Gráfico Entradas × Gastos por mês.
- Gráfico Gastos por categoria.
- Mobile responsivo.
- Toda a V7.2.5 de Orçamentos é preservada.

## Ordem de instalação
1. Execute `supabase_v8_0_mep_financeiro.sql`.
2. Em Data API / Exposed tables, habilite `public.user_module_preferences`.
3. Substitua no GitHub: index.html, app.js, styles.css, config.js e README.md.
4. Atualize a página sem cache.
5. Teste PF, CNPJ, Orçamentos, Resumo e mobile.

## Observação
A V8 não apaga dados antigos.
