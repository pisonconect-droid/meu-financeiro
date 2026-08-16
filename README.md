# Meu Financeiro V8.0.2 — Correção Operacional

Esta atualização completa a parte operacional que não entrou na V8.0.1.

## Dia a dia
- Categorias não ficam mais todas expostas.
- `Tudo` mostra todos os lançamentos.
- `Categorias` abre/fecha os filtros.
- ⚙ abre o gerenciamento de categorias.
- ▥ abre o Resumo Financeiro.
- Lançamentos confirmados não exibem Excluir.
- Ações ficam no menu `⋮`.

## Contas a pagar
- Organizadas em Urgentes, Prioritárias e Podem esperar.
- Mostram vencimento relativo: vencida, hoje, amanhã ou em X dias.
- Apenas `+` fica exposto para adicionar conta.
- Marcar paga / Editar / Remover ficam em `⋮`.
- Conta paga gera gasto e deixa a lista de contas a pagar.

## Contas fixas
- Apenas `+` fica exposto.
- Dentro dele: Nova conta fixa / Gerar mês atual.
- Editar e Remover ficam em `⋮`.

## Resumo
- Sai da página operacional.
- Acessado pelo ícone ▥.
- Gráfico mensal e gastos por categoria corrigidos para ler PF/CNPJ pela coluna `conta`.

## Instalação
Não requer novo SQL.
Substitua no GitHub:
- index.html
- app.js
- styles.css
- config.js
- README.md
