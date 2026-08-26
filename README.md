# Meu Financeiro V8.9.7 — Exportação de Histórico para Conciliação

Adiciona em `Dia a dia` o botão **Baixar histórico** para PF e CNPJ.

O CSV inclui:
- Data
- Conta
- Tipo
- Descrição
- Categoria
- Valor
- Forma de pagamento/liquidação
- Impacta saldo?
- Contraparte
- Origem
- Situação
- Referência
- Observação
- Fonte técnica

Fontes exportadas:
- movimentacoes
- orcamento_recebimentos (CNPJ)
- conta_liquidacoes
- compensacoes

Ao final do CSV:
- Entradas com impacto em caixa
- Saídas com impacto em caixa
- Saldo calculado pelo histórico exportado
- Saldo exibido no app

Nenhuma alteração no Supabase. Esta MEP é somente leitura/exportação.
