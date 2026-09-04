import { parseInvoiceReference } from './invoice-reference';

/** Route params accept either "1038" or "INV-1038". */
export function parseInvoiceNumberParam(value: string): number {
  const raw = String(value || '').trim();
  const parsed = /^\d+$/.test(raw) ? Number(raw) : parseInvoiceReference(raw);
  if (!parsed || !Number.isSafeInteger(parsed) || parsed < 1) {
    const error = new Error('Número de invoice inválido.') as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  return parsed;
}

export function notFoundError(invoiceNumber: number): Error & { status?: number } {
  const error = new Error(`Invoice ${invoiceNumber} não encontrada.`) as Error & { status?: number };
  error.status = 404;
  return error;
}
