import { authenticationRequired, requireApiAuthentication } from '@/lib/auth';
import { certificateIsConfigured } from '@/lib/certificate';
import { getConfig } from '@/lib/config';
import { getPublicCustomers } from '@/lib/invoice-config';
import { getDpsSequence } from '@/lib/sequence';
import { errorResponse } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireApiAuthentication(request);
    const config = getConfig();
    let nextDpsNumber: number | null = null;
    let sequenceError: string | undefined;
    try {
      nextDpsNumber = await getDpsSequence(config.initialDpsNumber).peek();
    } catch (error) {
      sequenceError = error instanceof Error ? error.message : 'Sequência de DPS indisponível.';
    }
    return Response.json({
      environment: config.environment,
      certificateConfigured: certificateIsConfigured({ base64: config.certificateBase64, path: config.certificatePath }),
      productionEnabled: config.productionEnabled,
      nextDpsNumber,
      sequenceError,
      authenticationRequired: authenticationRequired(),
      customers: getPublicCustomers(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

