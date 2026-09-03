import { requireApiAuthentication } from '@/lib/auth';
import { certificateIsConfigured, loadCertificate } from '@/lib/certificate';
import { getConfig } from '@/lib/config';
import { buildDps, parseInvoiceInput } from '@/lib/dps';
import { errorResponse } from '@/lib/http';
import { decodeDocument, findEncodedNfse, issueNfse } from '@/lib/nfse-client';
import { getDpsSequence } from '@/lib/sequence';
import { signDps } from '@/lib/sign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    requireApiAuthentication(request);
    const config = getConfig();
    const input = parseInvoiceInput(await request.json());
    if (config.environment === 'production' && input.confirmProduction !== true) {
      return Response.json({ error: 'Confirmação explícita de produção ausente.' }, { status: 400 });
    }

    const certificateSource = {
      base64: config.certificateBase64,
      path: config.certificatePath,
      password: config.certificatePassword,
    };
    if (!certificateIsConfigured(certificateSource)) throw new Error('Certificado A1 não configurado.');
    const certificate = loadCertificate(certificateSource);
    const sequence = getDpsSequence(config.initialDpsNumber);

    // Validate all user-controlled fields before consuming a fiscal sequence number.
    buildDps(input, { environment: config.environment, dpsNumber: await sequence.peek() });
    const dpsNumber = await sequence.reserve();
    const unsignedXml = buildDps(input, { environment: config.environment, dpsNumber });
    const signedXml = signDps(unsignedXml, certificate.privateKeyPem, certificate.certificatePem);
    const result = await issueNfse({ baseUrl: config.baseUrl, certificate, signedXml });

    const encodedNfse = findEncodedNfse(result);
    const nfseXml = encodedNfse ? decodeDocument(encodedNfse) : null;
    const accessKey = nfseXml?.match(/<infNFSe\b[^>]*\bId=["']NFS(\d{50})["']/)?.[1] || null;
    return Response.json({ success: true, dpsNumber, accessKey, nfseXml });
  } catch (error) {
    return errorResponse(error);
  }
}
