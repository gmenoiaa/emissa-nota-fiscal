import { Resend } from 'resend';
import { formatInvoiceDate } from './dates';
import { getCustomer, invoiceIssuer } from './invoice-config';
import { invoicePdfFilename } from './invoice-pdf';
import type { InvoiceEmailReceipt, InvoiceRecord } from './types';

/** Resend's shared sender, usable before a domain of our own is verified. */
const TEST_SENDER = `GWM Informatica <onboarding@resend.dev>`;

export interface MailerStatus {
  configured: boolean;
  from: string;
  replyTo: string;
  /**
   * True while no verified domain is configured. Resend only delivers to the
   * account owner in this mode, so recipients are redirected instead of being
   * silently rejected with a 403.
   */
  testMode: boolean;
  /**
   * Where self-tests land. Always set, not only in test mode: with a verified
   * domain a real send reaches the customer, so trying one out first has to be
   * possible without mailing them.
   */
  testRecipient: string | null;
}

export function getMailerStatus(): MailerStatus {
  const from = process.env.INVOICE_FROM_EMAIL?.trim();
  const replyTo = process.env.INVOICE_REPLY_TO?.trim() || invoiceIssuer.email;
  const testRecipient = process.env.INVOICE_TEST_RECIPIENT?.trim() || replyTo;
  return {
    configured: Boolean(process.env.RESEND_API_KEY?.trim()),
    from: from || TEST_SENDER,
    replyTo,
    testMode: !from,
    testRecipient: testRecipient || null,
  };
}

export function getInvoiceRecipients(record: InvoiceRecord): string[] {
  try {
    return [...getCustomer(record.customerId).invoice.email.to];
  } catch {
    return [];
  }
}

function buildSubject(record: InvoiceRecord): string {
  return `Invoice ${record.reference} · ${invoiceIssuer.name}`;
}

export function buildInvoiceEmailBody(
  record: InvoiceRecord,
  redirectedFrom: string[] | null = null,
): { text: string; html: string } {
  const amount = `${record.currencyCode} ${Number(record.total).toFixed(2)}`;
  const lines = [
    `Hi,`,
    ``,
    `Please find attached invoice ${record.reference} for ${amount}, due ${formatInvoiceDate(record.dueDate)}.`,
    ``,
    // Split the note: HTML collapses newlines, so each line has to become its
    // own entry or the whole wire-information block runs together.
    ...record.note.split('\n'),
    ``,
    `Best regards,`,
    invoiceIssuer.name,
    invoiceIssuer.email,
  ];
  if (redirectedFrom) {
    lines.unshift(
      redirectedFrom.length
        ? `[TEST] This message would have been sent to: ${redirectedFrom.join(', ')}.`
        : `[TEST] This customer has no billing recipient registered.`,
      ``,
    );
  }
  const text = lines.join('\n');
  const html = `<div style="font:14px/1.6 -apple-system,Segoe UI,sans-serif;color:#18261f">${
    lines.map((line) => (line ? escapeHtml(line) : '<br/>')).join('<br/>')
  }</div>`;
  return { text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export interface SendInvoiceEmailOptions {
  record: InvoiceRecord;
  pdf: Buffer;
  to?: string[];
  /** Deliver to the operator instead of the customer, to try the message out. */
  test?: boolean;
}

export async function sendInvoiceEmail(options: SendInvoiceEmailOptions): Promise<InvoiceEmailReceipt> {
  const status = getMailerStatus();
  if (!status.configured) throw new Error('Configure RESEND_API_KEY para enviar invoices por e-mail.');

  const intended = (options.to?.length ? options.to : getInvoiceRecipients(options.record))
    .map((address) => address.trim())
    .filter(Boolean);

  // Test mode redirects because Resend refuses anyone but the account owner; an
  // explicit self-test redirects on purpose. Both show the customer in the body.
  const redirect = status.testMode || options.test === true;
  if (redirect && !status.testRecipient) {
    throw new Error('Configure INVOICE_TEST_RECIPIENT para enviar um teste.');
  }
  if (!redirect && !intended.length) throw new Error('Nenhum destinatário cadastrado para esta empresa.');

  const recipients = redirect ? [status.testRecipient as string] : intended;
  const body = buildInvoiceEmailBody(options.record, redirect ? intended : null);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: status.from,
    to: recipients,
    replyTo: status.replyTo,
    ...(!redirect && process.env.INVOICE_BCC?.trim() ? { bcc: [process.env.INVOICE_BCC.trim()] } : {}),
    subject: buildSubject(options.record),
    text: body.text,
    html: body.html,
    attachments: [{ filename: invoicePdfFilename(options.record), content: options.pdf }],
  });

  if (error) {
    const failure = new Error(`Resend recusou o envio: ${error.message}`) as Error & { details?: unknown };
    failure.details = error;
    throw failure;
  }

  return {
    sentAt: new Date().toISOString(),
    to: recipients,
    messageId: data?.id || '',
  };
}
