# Meu Financeiro V8.9.3 — Paisagem Forçada em Grade Desktop

## Diagnóstico
A detecção por touch/hover não foi aplicada de forma confiável no aparelho testado.
Por isso o orçamento continuava usando os cards mobile mesmo deitado.

## Correção
A regra agora é simples:
- orientação paisagem;
- largura mínima de 650px.

Nessas condições, `Itens comerciais` usa obrigatoriamente a grade:
Tipo | Descrição | Qtd. | Fornecimento | Valor unitário | Custo interno | Total | Excluir

Não depende mais de `hover`, `touch`, `maxTouchPoints` ou classe JavaScript.

## Preservação
- Retrato continua com cards mobile.
- Desktop continua compatível com a mesma grade.
- Sem alteração de dados.
- Sem alteração financeira.
- Sem alteração no Supabase.
- Se a tela não comportar 1000px, o scroll fica somente em Itens comerciais.

## Teste
1. Atualizar os arquivos.
2. Fechar e reabrir o app/PWA.
3. Abrir edição do orçamento.
4. Girar o celular.
5. Conferir a linha completa igual ao desktop.
