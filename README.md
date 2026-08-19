# Meu Financeiro V8.6.0 — Faturamento Acompanhado + Inteligência Financeira

## Conceitos separados
O aplicativo passa a apresentar separadamente:

1. **Serviço / situação operacional**
2. **Situação fiscal**
3. **Situação financeira**

Situação fiscal:
- Pendente
- NFS-e emitida
- Dispensada — cliente pessoa física

Situação financeira é derivada dos recebimentos:
- Aguardando pagamento
- Parcialmente pago
- Pago

Registrar NFS-e ou dispensa fiscal NÃO cria entrada financeira.

## Cliente PF / PJ
O cadastro de cliente recebe o campo `Tipo de cliente`.
A opção `Dispensada — cliente pessoa física` só aparece para cliente marcado como PF.
Não há automação tributária para PJ.

## Histórico financeiro
O orçamento mostra todos os recebimentos já registrados, com:
- data
- valor
- forma de pagamento
- parcela/referência

O histórico não é apagado quando o status muda.

## Faturamento acompanhado pelo app
Calculado SOMENTE com valores efetivamente registrados em `orcamento_recebimentos`.

Separação:
- Com NFS-e
- Sem NFS-e / PF
- Situação fiscal pendente, quando houver
- Total acompanhado

Despesas NÃO reduzem esse faturamento.
Saldo continua sendo calculado pelas movimentações financeiras existentes.

## Faturamento MEI acompanhado
Painel anual mostra:
- Com NFS-e
- Sem NFS-e / PF
- Total acompanhado
- Limite anual configurado pelo usuário
- Percentual utilizado
- Margem restante/excedente

O app NÃO contém limite legal hard-coded. O usuário configura o limite aplicável.
Sempre aparece a observação de que períodos anteriores podem não estar cadastrados.

Alertas informativos:
- 70%: informação
- 85%: atenção
- 95%: muito próximo
- 100% ou mais: atingiu/ultrapassou

Nenhum alerta bloqueia serviço, recebimento ou NFS-e.

## Inteligência financeira / Drill-down
Filtro:
- mês atual
- 3 meses
- 6 meses
- ano atual
- personalizado

Gráficos:
- Entradas × Gastos
- Gastos por categoria com clique para detalhar lançamentos
- Recebido / Resultado acompanhado / Valor dos serviços por cliente
- Mesmas métricas por serviço

Clique no cliente mostra os serviços que formam o resultado.
Clique no serviço mostra situação fiscal, financeira e histórico de recebimentos.

### Resultado acompanhado
Para evitar confundir caixa com orçamento:
- receita = recebimentos efetivos do período
- custos vinculados são alocados proporcionalmente ao recebimento do serviço no período

É um indicador gerencial do app, não uma apuração contábil/fiscal oficial.

## Persistência
Alterações no banco:
- `clientes.tipo_cliente`
- `orcamentos.situacao_fiscal`
- `profiles.mei_limite_anual`

Não há nova tabela.
Recebimentos continuam em `orcamento_recebimentos`.
NFS-e continua em `orcamento_nfse`.
DANFSe continua no bucket privado já homologado.

## Preservação
Não foram alteradas as regras homologadas de:
- saldo
- movimentações
- orçamento
- fotos Antes/Durante/Depois
- câmera/galeria
- materiais fornecidos pelo cliente
- PDF/compartilhamento
- NFS-e documental
- categorias
- transferências PF/CNPJ

## Instalação
1. Execute `supabase_v8_6_0_faturamento_inteligencia.sql`.
2. Substitua os arquivos no GitHub.
3. Atualize o app/PWA.

## Cenários de homologação
### A — O'MARTIN
NFS-e emitida R$ 6.000,00, sem pagamento:
- fiscal: NFS-e emitida
- financeiro: Aguardando pagamento
- faturamento recebido: R$ 0,00
- saldo: não altera

Após recebimento:
- financeiro: Pago
- entrada: R$ 6.000,00
- faturamento acompanhado com NFS-e: R$ 6.000,00

### B — PF sem NFS-e
Cliente marcado PF → `Dispensada — cliente pessoa física`.
Após receber R$ 3.000,00:
- entrada: R$ 3.000,00
- faturamento acompanhado sem NFS-e/PF: R$ 3.000,00

### C — Parcial
Serviço R$ 7.500,00, recebimento R$ 4.000,00:
- Parcialmente pago
- saldo a receber R$ 3.500,00
- faturamento acompanhado recebido R$ 4.000,00
