import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalDpsSequence } from '../lib/sequence';

test('reserves sequential DPS numbers durably', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-sequence-'));
  const sequence = createLocalDpsSequence(directory, 8);
  assert.equal(await sequence.peek(), 8);
  assert.equal(await sequence.reserve(), 8);
  assert.equal(await createLocalDpsSequence(directory, 999).peek(), 9);
});

