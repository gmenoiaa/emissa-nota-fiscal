import { requireApiAuthentication } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { notFoundError, parseInvoiceNumberParam } from '@/lib/invoice-http';
import { invoicePdfFilename, renderInvoicePdf } from '@/lib/invoice-pdf';
import { getInvoiceStore } from '@/lib/invoice-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    requireApiAuthentication(request);
    const invoiceNumber = parseInvoiceNumberParam((await params).number);
    const record = await getInvoiceStore().get(invoiceNumber);
    if (!record) throw notFoundError(invoiceNumber);

    // The PDF is a pure function of the stored record, so it is rebuilt on
    // demand instead of being kept in blob storage.
    const pdf = await renderInvoicePdf(record);
    const inline = new URL(request.url).searchParams.get('disposition') === 'inline';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${invoicePdfFilename(record)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
