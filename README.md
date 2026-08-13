# Meu Financeiro — V6 Correção Final

Pacote congelado de correções e melhorias.

## Correções
- M.O. cobrada não é descontada como custo.
- Custos reais: somente Peça/Item + Custos internos do serviço.
- Orçamento pago pode ser recalculado para corrigir lançamentos antigos.
- Exclusão de transferência remove as duas pontas.
- Navegação preserva a tela atual após atualização de dados/sessão.

## Navegação
- Home: Pessoa Física | CNPJ | Orçamentos.
- Calendário acessado de dentro de PF ou CNPJ.
- Orçamentos em página própria, vinculada financeiramente ao CNPJ.
- CNPJ mantém um resumo dos orçamentos.

## Experiência
- Visual premium e acordeões destacados.
- Olhinho de privacidade.
- Resumo financeiro mensal.
- Status: Rascunho → Enviado → Aprovado → Pago.
- Confirmações nas operações críticas.

## Ordem de instalação
1. Execute `supabase_v6_correcao_final.sql` no SQL Editor.
2. Em Data API → Exposed functions, exponha `recalcular_orcamento_pago`.
3. Suba `index.html`, `app.js`, `styles.css`, `config.js` e `README.md` no GitHub.
4. Aguarde o GitHub Pages e faça Ctrl+F5.

## Teste financeiro de referência
Saldo anterior: - R$ 1.500,00
Resultado líquido do serviço: + R$ 2.000,00
Saldo esperado: + R$ 500,00
