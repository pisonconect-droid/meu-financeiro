# Meu Financeiro V8.6.1 — Correções de Homologação

Corrige antes da homologação:
- data local das contas a pagar;
- total a pagar / próximos 30 dias;
- reconciliação de pagamentos históricos sem duplicar saldo;
- serviços antigos pagos exibidos como concluídos;
- drill-down funcional no gráfico de gastos por categoria;
- ativação dos gráficos de inteligência por cliente e serviço.

## Instalação
1. Execute `supabase_v8_6_1_correcao_homologacao.sql`.
2. Atualize os arquivos no GitHub.
3. Atualize/reabra o app.

## Testes
- Conta dia 20 em 18/08 => Vence em 2 dias.
- Reginaldo => Pago, recebido correto, a receber zero, sem nova entrada no caixa.
- Clique em uma fatia da pizza => lista dos gastos da categoria.
- Clique em cliente/serviço => detalhamento.
