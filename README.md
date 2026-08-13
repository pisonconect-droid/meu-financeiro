# Meu Financeiro V4 — Supabase

Primeira versão online sincronizada.

## Inclui
- Login e criação de conta.
- Sessão persistente.
- Dados sincronizados pelo Supabase.
- Pessoa Física e CNPJ.
- Entradas, gastos e saldo.
- Contas: atrasadas, a pagar e pagas.
- Orçamentos básicos gravados no Supabase.

## Configuração
Antes de publicar, edite `config.js`:

```js
const SUPABASE_URL = "SUA_PROJECT_URL";
const SUPABASE_PUBLISHABLE_KEY = "SUA_PUBLISHABLE_KEY";
```

Use somente a **Publishable key**.

Nunca coloque no GitHub:
- Secret key
- service_role
- senha do banco

## Arquivos
- index.html
- styles.css
- app.js
- config.js
- README.md

As próximas etapas adicionam Peças + M.O., status Aprovado/Pago, transferências, calendário e acordeões.
