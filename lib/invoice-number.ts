import path from 'node:path';
import { fixedInvoice } from './invoice-config';
import { getCounter, type Counter } from './sequence';

export { formatInvoiceReference, parseInvoiceReference } from './invoice-reference';

/** INV-1037 was the last invoice issued outside this app. */
const DEFAULT_INITIAL_NUMBER = 1038;

export function getInvoiceInitialNumber(): number {
  const configured = Number(process.env.INVOICE_NEXT_NUMBER || DEFAULT_INITIAL_NUMBER);
  if (!Number.isSafeInteger(configured) || configured < 1) {
    throw new Error('INVOICE_NEXT_NUMBER deve ser um inteiro positivo.');
  }
  return configured;
}

export function getInvoiceSequence(initialValue = getInvoiceInitialNumber()): Counter {
  return getCounter({
    filePath: path.join(process.cwd(), 'data', 'invoice-sequence.json'),
    field: 'nextInvoiceNumber',
    key: process.env.INVOICE_SEQUENCE_KEY?.trim() || `invoice:${fixedInvoice.providerCnpj}:next-number`,
    initialValue,
    label: 'invoice',
  });
}
