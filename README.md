# Meu Financeiro V8.9.5 — Compactação do Orçamento em Paisagem

## Diagnóstico
A V8.9.4 colocou os itens comerciais em uma única linha, mas o formulário continuava usando espaçamentos/larguras grandes no celular deitado.

Isso fazia:
- o botão `Salvar alterações` ficar parcialmente cortado;
- o botão `+ Item` poder sair da área confortável de visualização;
- a grade ocupar mais largura que o necessário.

## Correção
No modo paisagem:
- margens laterais do formulário foram reduzidas;
- `+ Item` permanece sempre junto ao cabeçalho;
- grade de Itens comerciais foi compactada;
- inputs diminuíram levemente, mantendo área de toque;
- ações finais foram compactadas;
- `Salvar alterações` ganhou largura máxima controlada;
- scroll horizontal continua restrito a Itens comerciais.

## Preservação
- Retrato não foi alterado.
- Nenhuma regra financeira foi alterada.
- Nenhuma regra de orçamento foi alterada.
- Nenhuma alteração no Supabase.
