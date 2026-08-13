# Meu Financeiro V5 — Fechamento

Versão final do escopo atual.

## Novidades
- Calendário financeiro com filtros Tudo / Pessoa Física / CNPJ.
- Contas e Orçamentos em acordeão.
- Transferência PF ↔ CNPJ.
- Orçamentos separados em Peças e M.O.
- Subtotais e total calculados automaticamente.
- Fluxo Orçamento → Aprovado → Pago.
- Somente o status Pago gera entrada automática no saldo CNPJ.
- Proteção no Supabase para evitar pagamento duplicado.

## Infraestrutura
- GitHub Pages
- Supabase Auth
- Supabase Database
- RLS por usuário
- Sincronização entre PC e celular

Não publicar Secret key, service_role ou senha do banco.
