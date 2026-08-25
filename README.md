# Meu Financeiro V8.9.2 — Paisagem Igual ao Desktop

## Diagnóstico
O breakpoint da V8.9.1 era acionado de forma inconsistente e regras antigas do layout mobile ainda mantinham os campos em cards/quebras de linha.

## Correção
A aplicação agora identifica:
- dispositivo touch;
- orientação paisagem.

Quando ambas são verdadeiras, o `body` recebe a classe `touch-landscape-budget`.

Somente em `Itens comerciais`, essa classe força a mesma estrutura visual de grade usada no desktop:
Tipo | Descrição | Qtd. | Fornecimento | Valor unitário | Custo interno | Total | Excluir

## Preservação
- Retrato continua com o layout mobile em cards.
- Desktop continua como já estava.
- A rotação não recarrega nem reconstrói o formulário.
- Dados digitados permanecem no mesmo DOM.
- Scroll horizontal, quando necessário, fica somente em Itens comerciais.
- Nenhuma regra financeira ou de orçamento foi alterada.
- Nenhuma mudança no Supabase.

## Teste
1. Abrir/criar orçamento no celular em retrato.
2. Digitar um valor/descrição.
3. Girar para paisagem.
4. Confirmar a grade em uma única linha como no desktop.
5. Voltar ao retrato.
6. Confirmar preservação dos dados.
