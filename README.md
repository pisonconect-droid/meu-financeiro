# Meu Financeiro V8.9.0 — Períodos Mensais + UX Paisagem dos Orçamentos

## Estado
ENTREGA PARA REVISÃO HUMANA. Não homologada.

## Períodos mensais
- Período inicial = mês atual.
- Entradas do mês, Gastos do mês e Resultado do mês usam o período selecionado.
- O saldo atual não é reiniciado ao trocar o mês.
- O histórico não é apagado.
- O seletor permite mês anterior, mês seguinte, escolha direta e retorno ao mês atual.
- Ao consultar outro mês, aparece `Período anterior`.
- A lista `Dia a dia` acompanha o período selecionado.
- Contas, faturas, recebimentos e demais obrigações não são encerrados ou apagados na virada do mês.

## Orçamento em paisagem
- Retrato preserva os cards atuais.
- Em paisagem, celular/tablet entre 560 e 1100 px mostra Itens comerciais em linha, semelhante ao desktop.
- Descrição recebe maior largura.
- Quantidade permanece compacta.
- Tipo, Fornecimento, Valor, Custo e Total ficam alinhados.
- Se necessário, o scroll horizontal fica restrito à área de Itens comerciais.
- A rotação é apenas CSS: não recarrega formulário e não altera os dados digitados.

## Banco
Nenhuma alteração de Supabase é necessária nesta MEP.

## Arquivos alterados
- index.html
- app.js
- styles.css
- README.md
- manifest.webmanifest

## Não executado
- commit
- push
- deploy
- publicação
- homologação
