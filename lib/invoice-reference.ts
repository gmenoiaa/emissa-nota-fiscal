/**
 * Pure reference helpers, safe to import from client components. Keep this file
 * free of Node built-ins: lib/invoice-number.ts pulls in fs/redis and must not
 * reach the browser bundle.
 */
export function formatInvoiceReference(invoiceNumber: number): string {
  if (!Number.isSafeInteger(invoiceNumber) || invoiceNumber < 1) {
    throw new Error('Número de invoice inválido.');
  }
  return `INV-${invoiceNumber}`;
}

export function parseInvoiceReference(reference: string): number | null {
  const match = /^INV-(\d+)$/.exec(String(reference).trim().toUpperCase());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}
