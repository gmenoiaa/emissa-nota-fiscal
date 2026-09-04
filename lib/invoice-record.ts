import { assertIsoDate, brazilNowIso, brazilToday, previousMonthReference } from './dates';
import { normalizeMoney } from './dps';
import { getCustomer, wireInformation } from './invoice-config';
import { formatInvoiceReference } from './invoice-reference';
import type { InvoiceInputPayload, InvoiceRecord, InvoiceStatus } from './types';

const INVOICE_STATUSES: InvoiceStatus[] = ['issued', 'paid', 'void'];

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus);
}

function normalizeQuantity(value: string | undefined): number {
  if (value === undefined || String(value).trim() === '') return 1;
  const quantity = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade maior que zero.');
  return quantity;
}

/** Cents arithmetic keeps rate x quantity exact for the amounts we bill. */
function multiplyMoney(rate: string, quantity: number): string {
  const rateCents = Math.round(Number(rate) * 100);
  const totalCents = Math.round(rateCents * quantity);
  if (totalCents <= 0) throw new Error('O total da invoice deve ser maior que zero.');
  return (totalCents / 100).toFixed(2);
}

function buildNote(referencePeriod: string, includeWireInformation: boolean): string {
  const lines = [`Ref: ${referencePeriod}`];
  if (includeWireInformation) lines.push('', ...wireInformation);
  return lines.join('\n');
}

export function parseInvoicePayload(value: unknown): InvoiceInputPayload {
  if (!value || typeof value !== 'object') throw new Error('Dados da invoice inválidos.');
  const input = value as Record<string, unknown>;
  const optional = (key: string) => (input[key] === undefined || input[key] === null ? undefined : String(input[key]));
  return {
    customerId: String(input.customerId || ''),
    lineItemDescription: optional('lineItemDescription'),
    quantity: optional('quantity'),
    rate: optional('rate'),
    issueDate: optional('issueDate'),
    dueDate: optional('dueDate'),
    referencePeriod: optional('referencePeriod'),
    note: optional('note'),
  };
}

export interface BuildInvoiceRecordOptions {
  number: number;
  createdAt?: string;
  today?: string;
}

/**
 * Copies every printable value into the record. Once stored, the invoice no
 * longer depends on the customer profile, so later profile edits cannot alter a
 * document that was already delivered.
 */
export function buildInvoiceRecord(payload: InvoiceInputPayload, options: BuildInvoiceRecordOptions): InvoiceRecord {
  const customer = getCustomer(String(payload.customerId || ''));
  const profile = customer.invoice;

  const issueDate = payload.issueDate ? assertIsoDate(payload.issueDate) : (options.today || brazilToday());
  const dueDate = payload.dueDate ? assertIsoDate(payload.dueDate) : issueDate;
  if (dueDate < issueDate) throw new Error('O vencimento não pode ser anterior à data da invoice.');

  const description = (payload.lineItemDescription ?? profile.lineItemDescription).trim();
  if (!description) throw new Error('Informe a descrição do serviço.');

  const quantity = normalizeQuantity(payload.quantity);
  const rate = normalizeMoney(payload.rate ?? customer.currency.foreignAmount);
  const referencePeriod = (payload.referencePeriod || previousMonthReference(issueDate)).trim();
  const note = payload.note?.trim() || buildNote(referencePeriod, profile.includeWireInformation);

  return {
    number: options.number,
    reference: formatInvoiceReference(options.number),
    customerId: customer.id,
    customerName: profile.billingName,
    billingAddress: [...profile.billingAddress],
    ...(profile.contractorLine ? { contractorLine: profile.contractorLine } : {}),
    lineItem: { description, quantity, rate },
    currencyCode: customer.currency.code,
    total: multiplyMoney(rate, quantity),
    paidToDate: '0.00',
    issueDate,
    dueDate,
    note,
    status: 'issued',
    createdAt: options.createdAt || brazilNowIso(),
    email: null,
    nfse: null,
  };
}

export function invoiceBalance(record: Pick<InvoiceRecord, 'total' | 'paidToDate'>): string {
  const balanceCents = Math.round(Number(record.total) * 100) - Math.round(Number(record.paidToDate) * 100);
  return (balanceCents / 100).toFixed(2);
}
