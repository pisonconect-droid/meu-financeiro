# Meu Financeiro V7.2 — FINAL

## Escopo congelado
- Categorias personalizáveis e independentes para PF e CNPJ.
- Criar, editar e excluir/desativar categorias.
- Categorias técnicas protegidas para não quebrar automações.
- Filtros do Dia a dia baseados nas categorias cadastradas.
- Salvar orçamento em Rascunho, Enviado e Aprovado/Em andamento.
- Edição de orçamento aprovado ressincroniza os custos do CNPJ.
- Fotos Antes / Depois, inclusive em orçamento aprovado.
- PDF comercial para o cliente com fotos e valores cobrados.
- Custos internos, custos reais e resultado/lucro não aparecem no PDF.
- Resumo mensal de entradas/faturamento, gastos e resultado.
- Visão anual Janeiro–Dezembro.
- Total anual de faturamento/entradas, gastos, resultado e transferências.
- Gastos anuais acumulados por categoria.
- Transferências ficam separadas e não distorcem faturamento nem resultado operacional.
- Layout mobile da V7.1.3 preservado.

## Próxima versão
- Gráficos e visualizações financeiras.

## Instalação
1. Execute `supabase_v7_2_categorias.sql` no SQL Editor.
2. Em Data API → Exposed tables, marque `public.categorias`.
3. Não há função nova para expor.
4. Faça upload no GitHub de:
   - index.html
   - app.js
   - styles.css
   - config.js
   - README.md

## Homologação sugerida
1. Criar uma categoria nova no PF.
2. Criar outra categoria nova no CNPJ.
3. Confirmar que as listas são independentes.
4. Fazer um gasto em uma categoria e conferir filtro.
5. Conferir Resumo financeiro do ano.
6. Editar orçamento aprovado e salvar.
7. Inserir foto Antes e Depois.
8. Gerar PDF e conferir que custos internos não aparecem.
