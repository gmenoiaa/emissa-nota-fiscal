import test from 'node:test';
import assert from 'node:assert/strict';
import { invoicePdfFilename, renderInvoicePdf } from '../lib/invoice-pdf';
import { buildInvoiceRecord, parseInvoicePayload } from '../lib/invoice-record';

const options = { number: 1038, createdAt: '2026-09-03T10:00:00-03:00', today: '2026-09-03' };

const countPages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

test('renders a PDF for each registered customer', async () => {
  for (const customerId of ['apideck', 'cima']) {
    const record = buildInvoiceRecord(parseInvoicePayload({ customerId }), options);
    const pdf = await renderInvoicePdf(record);

    assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
    assert.ok(pdf.length > 1000, `${customerId} PDF is suspiciously small: ${pdf.length} bytes`);
    assert.equal(pdf.subarray(-6).toString('latin1').trim(), '%%EOF');
    // The Apideck note carries the full wire-information block; it must still fit
    // on a single page, which an earlier layout did not.
    assert.equal(countPages(pdf), 1, `${customerId} invoice should be one page`);
  }
});

test('names the file after the invoice reference', () => {
  assert.equal(invoicePdfFilename({ reference: 'INV-1038' }), 'INV-1038.pdf');
});
