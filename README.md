# Meu Financeiro V8.4.0 — Fornecimento de Materiais

## Alteração principal
Itens de Peça / Material agora possuem **Fornecimento**:
- Prestador
- Cliente

### Prestador
- Quantidade e valor unitário normais.
- Compõe o total do orçamento.
- Mantém custo interno e resultado financeiro atuais.

### Cliente
- Quantidade continua disponível.
- Valor unitário e custo interno são desabilitados.
- Não compõe o total financeiro.
- Pré-visualização e PDF mostram **Fornecido pelo cliente**.
- Não aparece como material gratuito fornecido pelo prestador.

### Mão de obra
- Continua sempre como fornecimento do prestador.
- Comportamento financeiro preservado.

## Registro técnico
Descrições continuam livres, portanto é possível registrar:
`Gavião — substituição mediante avaliação.`
A presença da descrição não altera automaticamente o status de execução.

## Fotos
- Antes / Durante / Depois preservados.
- Câmera e galeria preservadas.
- Legendas e exclusão individual preservadas.
- Compressão preservada.
- Fotos novas recebem hash e duplicadas no mesmo orçamento são rejeitadas.

## Compartilhamento
Fluxo homologado preservado:
Pré-visualizar → Gerar PDF → Compartilhar.

## Instalação
1. Execute `supabase_v8_4_0_fornecimento_materiais.sql`.
2. Não há tabela nova.
3. Substitua no GitHub os arquivos do pacote.
4. Faça Ctrl+F5.

## Cenário de validação recomendado
Orçamento 4 — O'Martin:
- M.O. Reforma da caçamba: R$ 7.500,00
- Chapa do fundo: Cliente
- Taliscas: Cliente
- Olhais: Cliente
- Gavião — substituição mediante avaliação: Cliente
- TOTAL esperado: R$ 7.500,00
