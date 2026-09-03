import type { NfseApiError } from './types';

export function errorResponse(error: unknown): Response {
  const known = error as NfseApiError;
  const status = known.status && known.status >= 400 && known.status < 600 ? known.status : 400;
  return Response.json({
    error: error instanceof Error ? error.message : 'Erro inesperado.',
    ...(known.details === undefined ? {} : { details: known.details }),
  }, { status });
}
