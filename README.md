# Meu Financeiro V7.1.3 — Botões no Mobile

- Corrige botões Editar, Registrar custo, Marcar pago e Excluir que ficaram fora da área visível do card.
- Card passa a crescer automaticamente conforme o conteúdo.
- Não altera Supabase nem regras financeiras.

# Meu Financeiro V7.1.2 — Correção Mobile

- Card de orçamento forçado para uma coluna no celular.
- Valores, custos internos e ações ocupam 100% da largura.
- Formulários de orçamento também passam para uma coluna.
- Sem alteração no Supabase ou nas regras financeiras.

# Meu Financeiro V7.1.1 — Ajuste Mobile

Esta atualização é exclusivamente visual/responsiva.

- Cards de orçamento passam para uma coluna no celular.
- Valores e custos ficam empilhados e legíveis.
- Botões quebram de linha sem sair da tela.
- Textos longos respeitam a largura do aparelho.
- Cabeçalho fica mais compacto.
- Fotos e custos internos respeitam 100% da largura.
- Desktop e regras financeiras permanecem preservados.
- Não requer alteração no Supabase.

# Meu Financeiro V7.1 — Ajustes de uso real

## Corrigido
- Filtros do Dia a dia agora realmente filtram os lançamentos por categoria.
- A categoria aparece junto ao lançamento.

## Orçamento aprovado
- Orçamento Aprovado/Em andamento pode ser editado.
- Ao salvar alterações em peças/custos de um orçamento aprovado, o financeiro CNPJ é ressincronizado sem duplicar os custos.
- Orçamento Pago continua bloqueado para preservar o histórico.

## Fotos
- Fotos separadas em **Antes** e **Depois**.
- É possível acrescentar fotos ao editar um orçamento aprovado.
- Fotos já salvas aparecem identificadas no formulário.

## Instalação
1. Execute `supabase_v7_1_ajustes.sql` no SQL Editor.
2. Não é necessário expor função nova: `aprovar_orcamento` já está exposta.
3. Depois substitua no GitHub os 5 arquivos: index.html, app.js, styles.css, config.js e README.md.
