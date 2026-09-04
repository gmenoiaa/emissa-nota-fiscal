import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoiceEmailBody, getInvoiceRecipients, getMailerStatus } from '../lib/mailer';
import { buildInvoiceRecord, parseInvoicePayload } from '../lib/invoice-record';

const options = { number: 1038, createdAt: '2026-09-03T10:00:00-03:00', today: '2026-09-03' };

const MAIL_ENV = ['RESEND_API_KEY', 'INVOICE_FROM_EMAIL', 'INVOICE_REPLY_TO', 'INVOICE_TEST_RECIPIENT'];

function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const saved = Object.fromEntries(MAIL_ENV.map((key) => [key, process.env[key]]));
  try {
    for (const key of MAIL_ENV) delete process.env[key];
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) process.env[key] = value;
    }
    return run();
  } finally {
    for (const key of MAIL_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('falls back to the shared Resend sender until a domain is verified', () => {
  const status = withEnv(
    { RESEND_API_KEY: 're_test', INVOICE_TEST_RECIPIENT: 'me@example.com' },
    getMailerStatus,
  );
  assert.equal(status.configured, true);
  assert.equal(status.testMode, true);
  assert.match(status.from, /onboarding@resend\.dev/);
  assert.equal(status.testRecipient, 'me@example.com');
});

test('leaves test mode once a verified sender is configured', () => {
  const status = withEnv(
    {
      RESEND_API_KEY: 're_test',
      INVOICE_FROM_EMAIL: 'GWM Informatica <billing@gwminfo.net>',
      INVOICE_TEST_RECIPIENT: 'me@example.com',
    },
    getMailerStatus,
  );
  assert.equal(status.testMode, false);
  assert.equal(status.from, 'GWM Informatica <billing@gwminfo.net>');
  // Still available, so a real send can be tried out without mailing the customer.
  assert.equal(status.testRecipient, 'me@example.com');
});

test('reports the mailer as unconfigured without an API key', () => {
  assert.equal(withEnv({}, getMailerStatus).configured, false);
});

test('defaults the reply-to and test recipient to the issuer address', () => {
  const status = withEnv({ RESEND_API_KEY: 're_test' }, getMailerStatus);
  assert.equal(status.replyTo, 'gwminfoltda@gmail.com');
  assert.equal(status.testRecipient, 'gwminfoltda@gmail.com');
});

test('reads billing recipients from the customer profile', () => {
  const apideck = buildInvoiceRecord(parseInvoicePayload({ customerId: 'apideck' }), options);
  const cima = buildInvoiceRecord(parseInvoicePayload({ customerId: 'cima' }), options);

  assert.deepEqual(getInvoiceRecipients(apideck), ['ap@apideck.com']);
  // Cima is billed through the agency's own flow and must never be auto-mailed.
  assert.deepEqual(getInvoiceRecipients(cima), []);
});

test('keeps every wire-information line separate in the HTML body', () => {
  const record = buildInvoiceRecord(parseInvoicePayload({ customerId: 'apideck' }), options);
  const body = buildInvoiceEmailBody(record);

  // HTML collapses newlines, so the note has to arrive as explicit breaks or the
  // whole wire block renders as one run-on paragraph.
  assert.match(body.html, /Wire information:<br\/>Beneficiary: GWM INFORMATICA LTDA<br\/>/);
  assert.match(body.html, /Bank Name: BANCO OURINVEST S\.A\.<br\/>/);
  assert.equal(body.html.includes('BANCO OURINVEST S.A. Bank Address'), false);

  for (const line of record.note.split('\n').filter(Boolean)) {
    assert.ok(body.text.split('\n').includes(line), `plain text lost: ${line}`);
  }
});

test('marks a redirected message and still breaks the note', () => {
  const record = buildInvoiceRecord(parseInvoicePayload({ customerId: 'apideck' }), options);
  const body = buildInvoiceEmailBody(record, ['ap@apideck.com']);

  assert.match(body.text, /^\[TEST\] This message would have been sent to: ap@apideck\.com\./);
  assert.match(body.html, /Wire information:<br\/>/);
});
