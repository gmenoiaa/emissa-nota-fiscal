# Emissão de NFS-e

Aplicação Next.js + TypeScript para preparar, assinar e emitir NFS-e pelo padrão nacional.

## Dados já mapeados

- Prestador: GWM INFORMATICA LTDA, Maringá/PR
- Serviço: `080201`, código municipal `006`
- Apideck: Bélgica, EUR, valor estrangeiro de 6.500,00
- Cima Staffing: Estados Unidos, USD, valor estrangeiro de 8.000,00

O formulário pede somente empresa, valor convertido em reais e descrição/invoice. Nome fiscal, endereço, país, moeda e valor estrangeiro vêm do cadastro protegido no servidor.

## Desenvolvimento local

1. Execute `npm install`.
2. Copie `.env.example` para `.env.local`.
3. Execute `npm run dev`.
4. Abra `http://localhost:4173`.

Sem certificado, a aplicação permite revisar a DPS, mas mantém a emissão desabilitada. Localmente, a sequência fica em `data/dps-sequence.json`.

## Certificado A1

No computador, coloque o `.pfx`/`.p12` em `certificates/` e configure `NFSE_CERT_PATH` e `NFSE_CERT_PASSWORD`.

Na Vercel, não envie o arquivo ao repositório. Converta-o para uma única linha base64 e salve o conteúdo em `NFSE_CERT_BASE64`; salve a senha separadamente em `NFSE_CERT_PASSWORD`. Exemplo local:

```bash
openssl base64 -A -in certificates/certificate.pfx
```

O certificado, sua senha, `.env.local` e arquivos emitidos são ignorados pelo Git.

## Deploy na Vercel

1. Envie o projeto a um repositório Git privado e importe-o na Vercel.
2. Adicione uma integração Upstash Redis pelo Marketplace da Vercel.
3. Configure `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. Configure `APP_PASSWORD` com uma senha longa e exclusiva.
5. Configure `AUTH_SECRET` com um segredo aleatório diferente da senha.
6. Configure `NFSE_CERT_BASE64`, `NFSE_CERT_PASSWORD` e `NFSE_NEXT_DPS_NUMBER`.
7. Comece com `NFSE_ENV=restricted` e `NFSE_ALLOW_PRODUCTION=false`.
8. Para as invoices, configure `INVOICE_NEXT_NUMBER`, `INVOICE_SEQUENCE_KEY` e,
   se for enviar por e-mail, `RESEND_API_KEY` (veja *Invoices comerciais*).

A aplicação exige autenticação em qualquer deploy Vercel. O Redis é obrigatório nesse ambiente para reservar números de DPS atomicamente; o filesystem temporário não é usado. Após uma emissão, o navegador baixa imediatamente o XML retornado.

## Invoices comerciais

A aba **Invoices** (`/invoices`) gera as invoices enviadas aos clientes, no
padrão das emitidas anteriormente pelo Invoicely, e mantém a lista do que já foi
gerado.

- **Numeração**: sequencial e contínua a partir de `INV-1038`, reservada de forma
  atômica no Redis (ou em `data/invoice-sequence.json` localmente). Um payload
  inválido é rejeitado antes de consumir um número, então a sequência não abre
  buracos.
- **Registro**: cada invoice é gravada como um snapshot completo. Alterar o
  cadastro de um cliente depois não altera nenhuma invoice já emitida.
- **PDF**: gerado sob demanda a partir do registro (`GET /api/invoices/1038/pdf`),
  em inglês, uma página. Nada é guardado em blob storage.
- **E-mail**: envio explícito por invoice. Apideck tem `ap@apideck.com`
  cadastrado; a Cima Staffing não recebe e-mail, só gera o PDF. Reenvio exige
  confirmação para não cobrar o cliente duas vezes.
- **Vínculo com a NFS-e**: o botão *Emitir* leva ao formulário de NFS-e já
  preenchido com a empresa e o número da invoice. Depois da emissão, a DPS e a
  chave de acesso ficam registradas na invoice.

### Configuração do Resend

Enquanto não houver um domínio próprio verificado, deixe `INVOICE_FROM_EMAIL`
vazio: a aplicação usa o remetente de teste do Resend, que **só entrega para o
e-mail dono da conta**. Nesse modo o destinatário real é substituído por
`INVOICE_TEST_RECIPIENT` e citado no corpo da mensagem, e a tela mostra
`e-mail em teste → …`. Para enviar de verdade ao cliente, verifique um domínio no
Resend e preencha `INVOICE_FROM_EMAIL` (ex.: `GWM Informatica <billing@seudominio.com.br>`).

## Produção

Produção exige simultaneamente:

- `NFSE_ENV=production`
- `NFSE_ALLOW_PRODUCTION=true`
- confirmação explícita na tela a cada emissão

A aplicação usa a série `1`, dentro da faixa oficial `00001–49999` reservada a aplicativos próprios. A série `70000` observada nos XMLs de referência pertence exclusivamente ao Emissor Web e não pode ser usada pela API. Como esta é uma série nova, a sequência começa em DPS 1. O Redis usa por padrão uma chave específica para o CNPJ e a série (`nfse:28220610000110:00001:next-dps-number`).

## Confirmações fiscais pendentes

- Confirmar que o valor estrangeiro é fixo: EUR 6.500,00 para Apideck e USD 8.000,00 para Cima.
- Confirmar o mecanismo de apoio ao comércio exterior: as notas mais recentes usam `01`, enquanto uma nota anterior da Apideck usa `02`.
