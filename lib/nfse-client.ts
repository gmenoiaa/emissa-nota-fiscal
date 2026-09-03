import https from 'node:https';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { LoadedCertificate, NfseApiError } from './types';

export function encodeDps(xml: string): string {
  return gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
}

export function decodeDocument(value: string): string {
  return gunzipSync(Buffer.from(value, 'base64')).toString('utf8');
}

export function findEncodedNfse(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === 'nfsexmlgzipb64' && typeof child === 'string') return child;
    const nested = findEncodedNfse(child);
    if (nested) return nested;
  }
  return null;
}

interface IssueOptions {
  baseUrl: string;
  certificate: LoadedCertificate;
  signedXml: string;
}

export async function issueNfse({ baseUrl, certificate, signedXml }: IssueOptions): Promise<unknown> {
  const endpoint = new URL(`${baseUrl.replace(/\/$/, '')}/nfse`);
  const body = JSON.stringify({ dpsXmlGZipB64: encodeDps(signedXml) });
  const { statusCode, text } = await new Promise<{ statusCode: number; text: string }>((resolve, reject) => {
    const request = https.request(endpoint, {
      method: 'POST', pfx: certificate.pfx, passphrase: certificate.passphrase, minVersion: 'TLSv1.2',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode || 500, text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.setTimeout(30_000, () => request.destroy(new Error('Tempo limite de conexão com a NFS-e excedido.')));
    request.on('error', reject);
    request.end(body);
  });

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (statusCode < 200 || statusCode >= 300) {
    const error = new Error('A API da NFS-e rejeitou a solicitação.') as NfseApiError;
    error.status = statusCode;
    error.details = data;
    throw error;
  }
  return data;
}

