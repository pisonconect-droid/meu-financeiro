# Meu Financeiro V8.9.4 — Linha Única no Orçamento em Paisagem

## Diagnóstico
Os títulos já estavam em grade, porém regras mobile antigas ainda forçavam:
- Descrição a ocupar uma linha inteira;
- Total a ocupar uma linha inteira;
- wrappers dos campos a se comportarem como cards.

Por isso o orçamento continuava quebrado mesmo em paisagem.

## Correção
No modo paisagem:
- cada wrapper do item é uma célula real da grade;
- cada campo recebe explicitamente sua coluna;
- todos os 8 elementos ficam na mesma linha:
  Tipo | Descrição | Qtd. | Fornecimento | Valor unitário | Custo interno | Total | Excluir
- regras mobile de `grid-column:1/-1` são anuladas;
- scroll horizontal, quando necessário, fica apenas em Itens comerciais.

## Preservação
- Retrato não foi alterado.
- Nenhuma regra de orçamento foi alterada.
- Nenhuma regra financeira foi alterada.
- Nenhuma mudança no Supabase.
