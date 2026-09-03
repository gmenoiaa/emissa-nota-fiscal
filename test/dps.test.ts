import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { buildDps, normalizeMoney, type BuildDpsOptions } from '../lib/dps';
import { encodeDps, decodeDocument, findEncodedNfse } from '../lib/nfse-client';

const select = xpath.useNamespaces({ n: 'http://www.sped.fazenda.gov.br/nfse' });
const parse = (xml: string) => new DOMParser().parseFromString(xml);

test('normalizes Brazilian currency', () => assert.equal(normalizeMoney('37.204,60'), '37204.60'));

test('creates an Apideck DPS from the registered profile', () => {
  const xml = buildDps(
    { customerId: 'apideck', amount: '1.234,56', description: 'INV-2000' },
    { dpsNumber: 8, environment: 'restricted', issuedAt: '2026-09-03T10:00:00-03:00' },
  );
  const doc = parse(xml);
  assert.equal(select('string(/n:DPS/n:infDPS/n:toma/n:xNome)', doc), 'apideck');
  assert.equal(select('string(//n:cPais)', doc), 'BE');
  assert.equal(select('string(//n:tpMoeda)', doc), '978');
  assert.equal(select('string(//n:vServMoeda)', doc), '6500.00');
  assert.equal(select('string(//n:vServ)', doc), '1234.56');
  assert.equal(select('string(//n:xDescServ)', doc), 'INV-2000');
  assert.equal(select('string(//n:tpAmb)', doc), '2');
  assert.equal(select('string(/n:DPS/n:infDPS/n:serie)', doc), '1');
  assert.equal(select('string(/n:DPS/n:infDPS/@Id)', doc), 'DPS411520022822061000011000001000000000000008');
});

test('creates a Cima DPS with USD and the registered US address', () => {
  const xml = buildDps(
    { customerId: 'cima', amount: '40.124,86', description: 'INV-1033' },
    { dpsNumber: 9, environment: 'restricted', issuedAt: '2026-09-03T10:00:00-03:00' },
  );
  const doc = parse(xml);
  assert.equal(select('string(//n:toma/n:xNome)', doc), 'Cima Staffing');
  assert.equal(select('string(//n:cPais)', doc), 'US');
  assert.equal(select('string(//n:tpMoeda)', doc), '840');
  assert.equal(select('string(//n:vServMoeda)', doc), '8000.00');
  assert.equal(select('string(//n:xCpl)', doc), 'Suite 401');
  assert.equal(select('string(//n:vServ)', doc), '40124.86');
  assert.equal(select('string(//n:cPaisResult)', doc), 'US');
});

test('requires a DPS sequence number', () => {
  assert.throws(() => buildDps(
    { customerId: 'apideck', amount: '10', description: 'INV' },
    undefined as unknown as BuildDpsOptions,
  ), /DPS/);
});

test('rejects customers outside the registered list', () => {
  assert.throws(() => buildDps(
    { customerId: 'unknown', amount: '10', description: 'INV' },
    { dpsNumber: 10 },
  ), /cadastrada/);
});

test('round-trips the official gzip/base64 envelope', () => {
  const xml = '<DPS>teste</DPS>';
  const encoded = encodeDps(xml);
  assert.equal(decodeDocument(encoded), xml);
  assert.equal(findEncodedNfse({ documentos: { nfseXmlGZipB64: encoded } }), encoded);
});
