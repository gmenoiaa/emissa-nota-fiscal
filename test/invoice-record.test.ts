import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInvoiceDate, previousMonthReference } from '../lib/dates';
import { buildInvoiceRecord, invoiceBalance, parseInvoicePayload } from '../lib/invoice-record';
import { formatInvoiceReference, parseInvoiceReference } from '../lib/invoice-number';
import { getInvoiceCustomerDefaults, getNfseCustomer, getPublicCustomers } from '../lib/invoice-config';

const options = { number: 1038, createdAt: '2026-09-03T10:00:00-03:00', today: '2026-09-03' };

test('builds an Apideck invoice from the registered profile', () => {
  const record = buildInvoiceRecord(parseInvoicePayload({ customerId: 'apideck' }), options);

  assert.equal(record.reference, 'INV-1038');
  assert.equal(record.customerName, 'Apideck');
  assert.deepEqual(record.billingAddress, ['Broederminstraat 9', '2018 Antwerp', 'Belgium']);
  assert.equal(record.currencyCode, 'EUR');
  assert.equal(record.lineItem.description, 'Consultancy fixed monthly rate');
  assert.equal(record.lineItem.rate, '6500.00');
  assert.equal(record.total, '6500.00');
  assert.equal(record.paidToDate, '0.00');
  assert.equal(record.issueDate, '2026-09-03');
  assert.equal(record.dueDate, '2026-09-03');
  assert.equal(record.status, 'issued');
  assert.equal(record.email, null);
  assert.equal(record.nfse, null);
  assert.equal(record.contractorLine, undefined);
  assert.match(record.note, /^Ref: Aug\/2026/);
  assert.match(record.note, /BANCO OURINVEST S\.A\./);
});

test('builds a Cima invoice with the contractor line and no wire block', () => {
  const record = buildInvoiceRecord(parseInvoicePayload({ customerId: 'cima' }), options);

  assert.equal(record.currencyCode, 'USD');
  assert.equal(record.lineItem.description, 'Software Development Services');
  assert.equal(record.total, '8000.00');
  assert.equal(record.contractorLine, 'Contractor Geiser Wilian Menoia');
  assert.equal(record.note, 'Ref: Aug/2026');
});

test('multiplies rate by quantity without floating point drift', () => {
  const record = buildInvoiceRecord(
    parseInvoicePayload({ customerId: 'cima', rate: '1234,56', quantity: '3' }),
    options,
  );
  assert.equal(record.lineItem.rate, '1234.56');
  assert.equal(record.total, '3703.68');
});

test('accepts explicit dates and a custom reference period', () => {
  const record = buildInvoiceRecord(
    parseInvoicePayload({ customerId: 'cima', issueDate: '2026-10-01', dueDate: '2026-10-31', referencePeriod: 'Sep/2026' }),
    options,
  );
  assert.equal(record.issueDate, '2026-10-01');
  assert.equal(record.dueDate, '2026-10-31');
  assert.equal(record.note, 'Ref: Sep/2026');
});

test('rejects invalid invoice input', () => {
  assert.throws(() => buildInvoiceRecord(parseInvoicePayload({ customerId: 'unknown' }), options), /empresa cadastrada/);
  assert.throws(
    () => buildInvoiceRecord(parseInvoicePayload({ customerId: 'cima', dueDate: '2026-09-02' }), options),
    /vencimento não pode ser anterior/,
  );
  assert.throws(() => buildInvoiceRecord(parseInvoicePayload({ customerId: 'cima', rate: '0' }), options), /maior que zero/);
  assert.throws(() => buildInvoiceRecord(parseInvoicePayload({ customerId: 'cima', quantity: '0' }), options), /maior que zero/);
  assert.throws(() => buildInvoiceRecord(parseInvoicePayload({ customerId: 'cima', issueDate: '03/09/2026' }), options), /AAAA-MM-DD/);
});

test('formats invoice references and dates like the reference documents', () => {
  assert.equal(formatInvoiceReference(1038), 'INV-1038');
  assert.equal(parseInvoiceReference('inv-1038'), 1038);
  assert.equal(parseInvoiceReference('1038'), null);
  assert.equal(formatInvoiceDate('2026-09-03'), 'Sep 03 2026');
  assert.equal(previousMonthReference('2026-01-15'), 'Dec/2025');
});

test('registers GWM Info for invoices only', () => {
  const record = buildInvoiceRecord(parseInvoicePayload({ customerId: 'gwm-info' }), options);
  assert.equal(record.customerName, 'GWM Info');
  assert.equal(record.currencyCode, 'BRL');
  assert.equal(record.total, '100.00');
  assert.equal(record.lineItem.description, 'Test invoice');

  // The test entity must not show up as an NFS-e taxpayer.
  assert.equal(getPublicCustomers().some(({ id }) => id === 'gwm-info'), false);
  assert.equal(getInvoiceCustomerDefaults().some(({ id }) => id === 'gwm-info'), true);
  assert.throws(() => getNfseCustomer('gwm-info'), /empresa de teste/);
});

test('computes the outstanding balance', () => {
  assert.equal(invoiceBalance({ total: '6500.00', paidToDate: '0.00' }), '6500.00');
  assert.equal(invoiceBalance({ total: '6500.00', paidToDate: '1500.50' }), '4999.50');
});
