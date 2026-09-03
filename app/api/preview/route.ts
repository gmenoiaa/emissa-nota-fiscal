import { requireApiAuthentication } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { buildDps, parseInvoiceInput } from '@/lib/dps';
import { errorResponse } from '@/lib/http';
import { getDpsSequence } from '@/lib/sequence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireApiAuthentication(request);
    const config = getConfig();
    const input = parseInvoiceInput(await request.json());
    const dpsNumber = await getDpsSequence(config.initialDpsNumber).peek();
    return Response.json({ dpsNumber, xml: buildDps(input, { environment: config.environment, dpsNumber }) });
  } catch (error) {
    return errorResponse(error);
  }
}

