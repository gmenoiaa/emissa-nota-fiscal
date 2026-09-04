import { requireApiAuthentication } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { notFoundError, parseInvoiceNumberParam } from '@/lib/invoice-http';
import { getInvoiceSequence } from '@/lib/invoice-number';
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

function conflict(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = 409;
  return error;
}

export async function DELETE(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    requireApiAuthentication(request);
    const invoiceNumber = parseInvoiceNumberParam((await params).number);

    const store = getInvoiceStore();
    const record = await store.get(invoiceNumber);
    if (!record) throw notFoundError(invoiceNumber);

    // Deleting is only for records that never left the building. Anything the
    // customer or the tax authority has seen gets cancelled instead, so the
    // number stays on the books.
    if (record.email) {
      throw conflict(`${record.reference} já foi enviada ao cliente. Cancele-a em vez de excluir.`);
    }
    if (record.nfse) {
      throw conflict(`${record.reference} tem a NFS-e ${record.nfse.dpsNumber} vinculada. Cancele-a em vez de excluir.`);
    }

    await store.delete(invoiceNumber);

    // Reclaim the number when it was the most recent one, so deleting a mistake
    // does not leave a gap that reads like a hidden invoice.
    let numberReclaimed = false;
    try {
      numberReclaimed = await getInvoiceSequence().releaseIfLast(invoiceNumber);
    } catch {
      // The record is already gone; failing to rewind the counter only costs a number.
    }

    return Response.json({ deleted: true, number: invoiceNumber, numberReclaimed });
  } catch (error) {
    return errorResponse(error);
  }
}
