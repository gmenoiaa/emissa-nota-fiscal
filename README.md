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
3. Configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
4. Configure `APP_PASSWORD` com uma senha longa e exclusiva.
5. Configure `AUTH_SECRET` com um segredo aleatório diferente da senha.
6. Configure `NFSE_CERT_BASE64`, `NFSE_CERT_PASSWORD` e `NFSE_NEXT_DPS_NUMBER`.
7. Comece com `NFSE_ENV=restricted` e `NFSE_ALLOW_PRODUCTION=false`.

A aplicação exige autenticação em qualquer deploy Vercel. O Redis é obrigatório nesse ambiente para reservar números de DPS atomicamente; o filesystem temporário não é usado. Após uma emissão, o navegador baixa imediatamente o XML retornado.

## Produção

Produção exige simultaneamente:

- `NFSE_ENV=production`
- `NFSE_ALLOW_PRODUCTION=true`
- confirmação explícita na tela a cada emissão

A sequência começa em DPS 8 porque a maior DPS fornecida é 7. Ajuste `NFSE_NEXT_DPS_NUMBER` antes de inicializar o Redis se houver notas posteriores.

## Confirmações fiscais pendentes

- Confirmar que o valor estrangeiro é fixo: EUR 6.500,00 para Apideck e USD 8.000,00 para Cima.
- Confirmar o mecanismo de apoio ao comércio exterior: as notas mais recentes usam `01`, enquanto uma nota anterior da Apideck usa `02`.
