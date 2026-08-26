# Meu Financeiro V8.9.9 — Correção da Importação da Conciliação PF

## Causa raiz
O CSV usa `;` como separador. Algumas observações também continham `;`.
O parser V8.9.8 usava `split(";")`, deslocando colunas e fazendo várias linhas
receberem a mesma `source_key`.

O Supabase bloqueou corretamente a duplicidade pela constraint:
`bank_reconciliation_entries_user_id_reconciliation_id_source_key`.

## Correção
- Parser CSV agora entende campos entre aspas.
- CSV foi regravado com escaping/quoting correto.
- Antes de tocar no banco, o app valida:
  - todas as linhas possuem `source_key`;
  - nenhuma `source_key` está duplicada;
  - entradas, saídas e saldo fecham exatamente com os metadados.
- A reimportação usa a mesma conciliação e remove suas linhas anteriores antes
  de inserir o conjunto validado.

## Fonte de verdade PF Nubank
- Saldo inicial: R$ 4,34
- Entradas: R$ 3.159,00
- Saídas: R$ 3.105,38
- Saldo final: R$ 57,96

## Supabase
Nenhum SQL adicional é necessário após a estrutura V8.9.8 já ter sido criada.

## Preservação
- CNPJ não alterado.
- Orçamentos não alterados.
- Movimentações históricas não apagadas/regravadas.
- Nenhuma homologação automática.
