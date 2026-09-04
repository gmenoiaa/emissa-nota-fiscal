import { requireApiAuthentication } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { notFoundError, parseInvoiceNumberParam } from '@/lib/invoice-http';
import { renderInvoicePdf } from '@/lib/invoice-pdf';
import { getInvoiceStore } from '@/lib/invoice-store';
import { sendInvoiceEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    requireApiAuthentication(request);
    const invoiceNumber = parseInvoiceNumberParam((await params).number);
    const body = await request.json().catch(() => ({}));

    const store = getInvoiceStore();
    const record = await store.get(invoiceNumber);
    if (!record) throw notFoundError(invoiceNumber);
    if (record.status === 'void') throw new Error('Esta invoice está cancelada e não pode ser enviada.');

    const test = body?.test === true;

    // Re-sending bills the customer twice in their inbox, so it takes a
    // deliberate confirmation instead of a second click on the same button.
    // A self-test never reaches the customer, so it skips the guard.
    if (!test && record.email && body?.confirmResend !== true) {
      const error = new Error(
        `Invoice já enviada em ${record.email.sentAt} para ${record.email.to.join(', ')}. Confirme para reenviar.`,
      ) as Error & { status?: number };
      error.status = 409;
      throw error;
    }

    const pdf = await renderInvoicePdf(record);
    const receipt = await sendInvoiceEmail({ record, pdf, test });

    // A test must not mark the invoice as delivered to the customer.
    if (test) return Response.json({ record, test: receipt });
    return Response.json({ record: await store.update(invoiceNumber, { email: receipt }) });
  } catch (error) {
    return errorResponse(error);
  }
}
