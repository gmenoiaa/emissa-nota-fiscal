import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalInvoiceStore } from '../lib/invoice-store';
import { buildInvoiceRecord, parseInvoicePayload } from '../lib/invoice-record';

function temporaryStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-store-'));
  return { directory, store: createLocalInvoiceStore(directory) };
}

const record = (number: number, customerId = 'apideck') => buildInvoiceRecord(
  parseInvoicePayload({ customerId }),
  { number, createdAt: '2026-09-03T10:00:00-03:00', today: '2026-09-03' },
);

test('round-trips an invoice record', async () => {
  const { store } = temporaryStore();
  await store.save(record(1038));

  const stored = await store.get(1038);
  assert.equal(stored?.reference, 'INV-1038');
  assert.equal(stored?.total, '6500.00');
  assert.equal(await store.get(9999), null);
});

test('lists invoices newest first with a total count', async () => {
  const { store } = temporaryStore();
  await store.save(record(1038));
  await store.save(record(1039, 'cima'));
  await store.save(record(1040));

  const page = await store.list();
  assert.deepEqual(page.records.map((item) => item.number), [1040, 1039, 1038]);
  assert.equal(page.total, 3);

  const second = await store.list({ limit: 1, offset: 1 });
  assert.deepEqual(second.records.map((item) => item.number), [1039]);
  assert.equal(second.total, 3);
});

test('updates lifecycle fields but keeps the document identity', async () => {
  const { store } = temporaryStore();
  await store.save(record(1038));

  const updated = await store.update(1038, {
    status: 'paid',
    paidToDate: '6500.00',
    nfse: { dpsNumber: 7, accessKey: null, linkedAt: '2026-09-03T11:00:00-03:00' },
    number: 999,
    reference: 'INV-999',
    createdAt: 'tampered',
  });

  assert.equal(updated.status, 'paid');
  assert.equal(updated.paidToDate, '6500.00');
  assert.equal(updated.nfse?.dpsNumber, 7);
  assert.equal(updated.number, 1038);
  assert.equal(updated.reference, 'INV-1038');
  assert.equal(updated.createdAt, '2026-09-03T10:00:00-03:00');
});

test('fails clearly when updating an unknown invoice', async () => {
  const { store } = temporaryStore();
  await assert.rejects(() => store.update(4242, { status: 'paid' }), /Invoice 4242 não encontrada/);
});

test('returns an empty page before any invoice exists', async () => {
  const { directory } = temporaryStore();
  const store = createLocalInvoiceStore(path.join(directory, 'missing'));
  assert.deepEqual(await store.list(), { records: [], total: 0 });
});
