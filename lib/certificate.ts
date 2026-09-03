import fs from 'node:fs';
import forge from 'node-forge';
import type { LoadedCertificate } from './types';

interface CertificateSource {
  base64?: string;
  path?: string;
  password?: string;
}

export function certificateIsConfigured(source: CertificateSource): boolean {
  if (source.base64) return true;
  return Boolean(source.path && fs.existsSync(source.path));
}

export function loadCertificate(source: CertificateSource): LoadedCertificate {
  const pfx = source.base64
    ? Buffer.from(source.base64.replace(/\s/g, ''), 'base64')
    : source.path
      ? fs.readFileSync(source.path)
      : null;
  if (!pfx?.length) throw new Error('Certificado A1 não configurado.');

  try {
    const binary = pfx.toString('binary');
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binary), source.password || '');
    const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
    const keyBag = shrouded?.[0] || plain?.[0];
    const certificateBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const privateKey = keyBag?.key as forge.pki.rsa.PrivateKey | undefined;
    const certBag = privateKey
      ? certificateBags.find(({ cert }) => {
          const publicKey = cert?.publicKey as forge.pki.rsa.PublicKey | undefined;
          return publicKey?.n?.compareTo(privateKey.n) === 0;
        })
      : undefined;
    if (!privateKey || !certBag?.cert) throw new Error('Certificado ou chave privada não encontrados no arquivo A1.');

    return {
      pfx,
      passphrase: source.password || '',
      privateKeyPem: forge.pki.privateKeyToPem(privateKey),
      certificatePem: forge.pki.certificateToPem(certBag.cert),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('não encontrados')) throw error;
    throw new Error('Não foi possível abrir o certificado A1. Confira o arquivo e a senha.');
  }
}

