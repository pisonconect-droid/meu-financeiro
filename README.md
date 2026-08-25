# Meu Financeiro V8.9.6 — Tabela Isolada no Paisagem

## Diagnóstico real
O problema não estava no botão Salvar.

O cabeçalho de `Itens comerciais`, que possui largura de tabela, estava diretamente dentro do formulário.
Essa largura mínima aumentava a largura intrínseca do formulário inteiro.

Consequências:
- `Salvar alterações` era empurrado/cortado;
- `+ Item` podia sair da área visível;
- a página parecia mais larga que a tela.

## Correção
Foi criado `budget-items-scroll`, contendo:
- cabeçalho dos itens;
- todas as linhas dos itens.

Somente esse contêiner pode rolar horizontalmente.

O formulário permanece sempre limitado à largura da tela.

### Paisagem
- tabela: 920px, rolável internamente;
- + Item: permanece fora da rolagem e visível;
- Cancelar + Salvar: grade fixa 46px + espaço restante;
- Salvar ocupa somente a largura disponível da tela.

## Preservação
- Retrato preservado.
- Regras de orçamento preservadas.
- Nenhuma alteração financeira.
- Nenhuma alteração no Supabase.
