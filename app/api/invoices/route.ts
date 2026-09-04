import { requireApiAuthentication } from '@/lib/auth';
import { brazilToday, previousMonthReference } from '@/lib/dates';
import { errorResponse } from '@/lib/http';
import { getInvoiceCustomerDefaults } from '@/lib/invoice-config';
import { getInvoiceSequence } from '@/lib/invoice-number';
import { buildInvoiceRecord, parseInvoicePayload } from '@/lib/invoice-record';
import { getInvoiceStore } from '@/lib/invoice-store';
import { getMailerStatus } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    requireApiAuthentication(request);
    const url = new URL(request.url);
    const page = await getInvoiceStore().list({
      limit: Number(url.searchParams.get('limit')) || undefined,
      offset: Number(url.searchParams.get('offset')) || undefined,
    });

    let nextNumber: number | null = null;
    let sequenceError: string | undefined;
    try {
      nextNumber = await getInvoiceSequence().peek();
    } catch (error) {
      sequenceError = error instanceof Error ? error.message : 'Sequência de invoice indisponível.';
    }

    const today = brazilToday();
    const mailer = getMailerStatus();
    return Response.json({
      ...page,
      nextNumber,
      sequenceError,
      today,
      defaultReferencePeriod: previousMonthReference(today),
      customers: getInvoiceCustomerDefaults(),
      email: {
        configured: mailer.configured,
        testMode: mailer.testMode,
        testRecipient: mailer.testRecipient,
        from: mailer.from,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireApiAuthentication(request);
    const payload = parseInvoicePayload(await request.json());
    const store = getInvoiceStore();
    const sequence = getInvoiceSequence();

    // Validate everything against a peeked number first: a rejected payload must
    // never burn an invoice number and leave a gap in the sequence.
    buildInvoiceRecord(payload, { number: await sequence.peek() });
    const invoiceNumber = await sequence.reserve();
    const record = buildInvoiceRecord(payload, { number: invoiceNumber });
    await store.save(record);

    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
