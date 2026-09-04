import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalCounter, createLocalDpsSequence } from '../lib/sequence';

test('reserves sequential DPS numbers durably', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-sequence-'));
  const sequence = createLocalDpsSequence(directory, 8);
  assert.equal(await sequence.peek(), 8);
  assert.equal(await sequence.reserve(), 8);
  assert.equal(await createLocalDpsSequence(directory, 999).peek(), 9);
});


test('gives the last reserved number back so a deletion leaves no gap', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-release-'));
  const sequence = createLocalCounter({
    filePath: path.join(directory, 'invoice-sequence.json'),
    field: 'nextInvoiceNumber',
    initialValue: 1038,
    label: 'invoice',
  });

  assert.equal(await sequence.reserve(), 1038);
  assert.equal(await sequence.releaseIfLast(1038), true);
  assert.equal(await sequence.peek(), 1038);
});

test('refuses to give a number back once a later one was reserved', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-release-'));
  const sequence = createLocalCounter({
    filePath: path.join(directory, 'invoice-sequence.json'),
    field: 'nextInvoiceNumber',
    initialValue: 1038,
    label: 'invoice',
  });

  assert.equal(await sequence.reserve(), 1038);
  assert.equal(await sequence.reserve(), 1039);
  // 1038 is no longer the newest, so reclaiming it would hand out a duplicate.
  assert.equal(await sequence.releaseIfLast(1038), false);
  assert.equal(await sequence.peek(), 1040);
});
