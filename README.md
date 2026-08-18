# Meu Financeiro V8.4.1 — UX Mobile dos Itens

Correção de acabamento identificada em uso real no celular.

## Alterações
- Cada item comercial vira um card legível no mobile.
- Campos recebem rótulos visíveis: Tipo, Descrição, Quantidade, Fornecimento, Valor unitário, Custo interno e Total.
- Quando `Fornecimento = Cliente`, Valor unitário e Custo interno ficam ocultos no celular.
- O card mostra diretamente `Fornecido pelo cliente`.
- Botão de excluir fica no canto superior do item.
- Layout desktop permanece em formato de tabela.
- Nenhuma regra financeira, banco, PDF, fotos, clientes, status ou compartilhamento foi alterada.
- Não há alteração no Supabase.

## Instalação
Substitua os arquivos no GitHub e faça atualização forçada.
No celular, feche/reabra o PWA ou atualize a página instalada.

## Teste rápido
1. Abrir orçamento.
2. Material → Cliente: conferir que preço/custo somem e aparece `Fornecido pelo cliente`.
3. Material → Prestador: conferir Valor unitário e Custo interno.
4. M.O.: conferir funcionamento normal.
5. Salvar e confirmar que o total permanece inalterado.
