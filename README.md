# Meu Financeiro V8.5.0 — NFS-e vinculada ao orçamento

## Escopo
Acrescenta somente controle documental da NFS-e/DANFSe. O aplicativo NÃO emite nota fiscal.

## Nota Fiscal
Cada orçamento recebe seção recolhível `Nota Fiscal`.

Estados:
- Não emitida
- Emitida

Dados persistidos:
- Número da NFS-e
- Data de emissão
- Valor da NFS-e
- Data prevista de pagamento (opcional)
- DANFSe em PDF

Ações:
- Visualizar PDF
- Baixar PDF
- Compartilhar PDF quando suportado no dispositivo
- Editar dados
- Substituir PDF mediante confirmação

Não existe botão de exclusão da nota.

## Separação operacional / fiscal / financeira
A seção exibe separadamente:
- Operacional: em andamento / concluído
- Fiscal: não emitida / emitida
- Financeiro: aguardando pagamento / pago

Registrar NFS-e NÃO cria movimentação financeira e NÃO altera saldo.
Somente o fluxo de recebimento homologado continua gerando entrada no CNPJ.

## Consistência
Se o valor da NFS-e for diferente do orçamento, o registro é permitido e aparece o aviso:
`Valor da NFS-e diferente do valor total do orçamento.`

## Persistência
- Metadados: `public.orcamento_nfse`
- PDF: bucket privado `orcamento-documentos`
- Caminho: `user_id/orcamento_id/danfse.pdf`
- RLS impede acesso entre usuários.
- PDF não depende do armazenamento local do navegador.

## Instalação
1. Execute `supabase_v8_5_0_nfse.sql`.
2. No Data API, confirme que `public.orcamento_nfse` está exposta.
3. Substitua os arquivos no GitHub.
4. Faça Ctrl+F5/reabra o PWA.

## Homologação
Cenário:
- Cliente O'MARTIN
- Serviço R$ 6.000,00
- NFS-e R$ 6.000,00
- Após registrar: NFS-e Emitida / Aguardando pagamento
- Saldo não muda.
- Após registrar recebimento: fluxo financeiro existente gera a entrada.
