import { requireApiAuthentication } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { notFoundError, parseInvoiceNumberParam } from '@/lib/invoice-http';
import { isInvoiceStatus } from '@/lib/invoice-record';
import { getInvoiceStore } from '@/lib/invoice-store';
import type { InvoiceRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    requireApiAuthentication(request);
    const invoiceNumber = parseInvoiceNumberParam((await params).number);
    const record = await getInvoiceStore().get(invoiceNumber);
    if (!record) throw notFoundError(invoiceNumber);
    return Response.json({ record });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    requireApiAuthentication(request);
    const invoiceNumber = parseInvoiceNumberParam((await params).number);
    const body = await request.json();
    if (!isInvoiceStatus(body?.status)) throw new Error('Informe um status válido: issued, paid ou void.');

    const store = getInvoiceStore();
    const current = await store.get(invoiceNumber);
    if (!current) throw notFoundError(invoiceNumber);

    // Paid-to-date is derived from the status so the printed balance can never
    // disagree with the status shown in the list.
    const patch: Partial<InvoiceRecord> = { status: body.status };
    if (body.status === 'paid') patch.paidToDate = current.total;
    if (body.status === 'issued') patch.paidToDate = '0.00';

    return Response.json({ record: await store.update(invoiceNumber, patch) });
  } catch (error) {
    return errorResponse(error);
  }
}
