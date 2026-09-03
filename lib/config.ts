import type { NfseEnvironment } from './types';

const productionEnabled = process.env.NFSE_ALLOW_PRODUCTION === 'true';
const environment: NfseEnvironment = process.env.NFSE_ENV === 'production' ? 'production' : 'restricted';

export function getConfig() {
  if (environment === 'production' && !productionEnabled) {
    throw new Error('Produção solicitada, mas NFSE_ALLOW_PRODUCTION não está habilitado.');
  }

  const initialDpsNumber = Number(process.env.NFSE_NEXT_DPS_NUMBER || 8);
  if (!Number.isSafeInteger(initialDpsNumber) || initialDpsNumber < 1) {
    throw new Error('NFSE_NEXT_DPS_NUMBER deve ser um inteiro positivo.');
  }

  return {
    environment,
    productionEnabled,
    baseUrl: environment === 'production'
      ? (process.env.NFSE_PRODUCTION_URL || 'https://sefin.nfse.gov.br/SefinNacional')
      : (process.env.NFSE_RESTRICTED_URL || 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional'),
    certificatePath: process.env.NFSE_CERT_PATH || '',
    certificateBase64: process.env.NFSE_CERT_BASE64 || '',
    certificatePassword: process.env.NFSE_CERT_PASSWORD || '',
    initialDpsNumber,
    deployedOnVercel: process.env.VERCEL === '1',
  };
}

