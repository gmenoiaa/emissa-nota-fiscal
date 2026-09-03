import { SignedXml } from 'xml-crypto';

export function signDps(xml: string, privateKeyPem: string, certificatePem: string): string {
  const certificate = certificatePem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');
  const signer = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    getKeyInfoContent: () => `<X509Data><X509Certificate>${certificate}</X509Certificate></X509Data>`,
  });
  signer.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  signer.computeSignature(xml, { location: { reference: "//*[local-name(.)='infDPS']", action: 'after' } });
  return signer.getSignedXml();
}

