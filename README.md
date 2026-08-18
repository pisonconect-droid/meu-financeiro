# Meu Financeiro V8.3.0 — Cadastro de Clientes

## Escopo
- Cadastro interno de clientes.
- Nome/Razão Social, CPF/CNPJ, WhatsApp, e-mail e endereço.
- Busca no Novo Orçamento por nome ou documento.
- Seleção preenche nome e WhatsApp automaticamente.
- Botão + ao lado do cliente cadastra um novo cliente sem sair do orçamento.
- Orçamento fica vinculado ao cliente por `cliente_id`.
- Orçamentos antigos são preservados e vinculados automaticamente quando possível.
- Sem portal do cliente, equipamentos, favoritos ou complexidade adicional.

## Instalação
1. Execute `supabase_v8_3_0_clientes.sql`.
2. No Supabase Data API, confirme que `public.clientes` está exposta.
3. Substitua no GitHub: index.html, app.js, styles.css, config.js e README.md.
4. Ctrl+F5.

## Teste
Novo orçamento → digitar cliente → selecionar → conferir WhatsApp → salvar.
Depois criar outro orçamento e confirmar que o cliente é recuperado.
