import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import { fixedInvoice } from './invoice-config';
import type { InvoiceRecord } from './types';

export interface InvoiceListPage {
  records: InvoiceRecord[];
  total: number;
}

export interface InvoiceListOptions {
  limit?: number;
  offset?: number;
}

export interface InvoiceStore {
  save(record: InvoiceRecord): Promise<InvoiceRecord>;
  get(invoiceNumber: number): Promise<InvoiceRecord | null>;
  list(options?: InvoiceListOptions): Promise<InvoiceListPage>;
  /** Read-modify-write. This app has a single authenticated operator, so no lock is used. */
  update(invoiceNumber: number, patch: Partial<InvoiceRecord>): Promise<InvoiceRecord>;
  /** Hard removal, reserved for records that never left the building. */
  delete(invoiceNumber: number): Promise<void>;
}

const DEFAULT_LIMIT = 50;

function pageBounds(options?: InvoiceListOptions) {
  const limit = Math.min(Math.max(Number(options?.limit) || DEFAULT_LIMIT, 1), 200);
  const offset = Math.max(Number(options?.offset) || 0, 0);
  return { limit, offset };
}

/** Upstash may hand back an already-parsed object or the raw JSON string. */
function asRecord(value: unknown): InvoiceRecord | null {
  if (!value) return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return parsed && typeof parsed === 'object' ? (parsed as InvoiceRecord) : null;
}

function mergeRecord(current: InvoiceRecord, patch: Partial<InvoiceRecord>): InvoiceRecord {
  // The identity of an issued document is fixed; only its lifecycle fields move.
  const { number, reference, createdAt, ...mutable } = patch;
  return { ...current, ...mutable };
}

export function createLocalInvoiceStore(directory: string): InvoiceStore {
  const recordPath = (invoiceNumber: number) => path.join(directory, `${invoiceNumber}.json`);
  const readRecord = (invoiceNumber: number): InvoiceRecord | null => {
    const file = recordPath(invoiceNumber);
    if (!fs.existsSync(file)) return null;
    return asRecord(fs.readFileSync(file, 'utf8'));
  };
  const writeRecord = (record: InvoiceRecord) => {
    fs.mkdirSync(directory, { recursive: true });
    const file = recordPath(record.number);
    const temporaryPath = `${file}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(record, null, 2), { mode: 0o600 });
    fs.renameSync(temporaryPath, file);
    return record;
  };

  const store: InvoiceStore = {
    async save(record) { return writeRecord(record); },
    async get(invoiceNumber) { return readRecord(invoiceNumber); },
    async list(options) {
      const { limit, offset } = pageBounds(options);
      if (!fs.existsSync(directory)) return { records: [], total: 0 };
      const numbers = fs.readdirSync(directory)
        .map((name) => /^(\d+)\.json$/.exec(name)?.[1])
        .filter((value): value is string => Boolean(value))
        .map(Number)
        .sort((left, right) => right - left);
      const records = numbers.slice(offset, offset + limit)
        .map(readRecord)
        .filter((record): record is InvoiceRecord => Boolean(record));
      return { records, total: numbers.length };
    },
    async update(invoiceNumber, patch) {
      const current = readRecord(invoiceNumber);
      if (!current) throw notFound(invoiceNumber);
      return writeRecord(mergeRecord(current, patch));
    },
    async delete(invoiceNumber) {
      const file = recordPath(invoiceNumber);
      if (!fs.existsSync(file)) throw notFound(invoiceNumber);
      fs.unlinkSync(file);
    },
  };
  return store;
}

export function createRedisInvoiceStore(): InvoiceStore {
  const redis = Redis.fromEnv();
  const namespace = `invoice:${fixedInvoice.providerCnpj}`;
  const indexKey = `${namespace}:index`;
  const recordKey = (invoiceNumber: number) => `${namespace}:record:${invoiceNumber}`;

  const readMany = async (numbers: number[]): Promise<InvoiceRecord[]> => {
    if (!numbers.length) return [];
    const values = await redis.mget<unknown[]>(...numbers.map(recordKey));
    return values.map(asRecord).filter((record): record is InvoiceRecord => Boolean(record));
  };

  const store: InvoiceStore = {
    async save(record) {
      await redis.set(recordKey(record.number), JSON.stringify(record));
      await redis.zadd(indexKey, { score: record.number, member: String(record.number) });
      return record;
    },
    async get(invoiceNumber) {
      return asRecord(await redis.get(recordKey(invoiceNumber)));
    },
    async list(options) {
      const { limit, offset } = pageBounds(options);
      const [members, total] = await Promise.all([
        redis.zrange<string[]>(indexKey, offset, offset + limit - 1, { rev: true }),
        redis.zcard(indexKey),
      ]);
      return { records: await readMany(members.map(Number)), total };
    },
    async update(invoiceNumber, patch) {
      const current = await store.get(invoiceNumber);
      if (!current) throw notFound(invoiceNumber);
      return store.save(mergeRecord(current, patch));
    },
    async delete(invoiceNumber) {
      const current = await store.get(invoiceNumber);
      if (!current) throw notFound(invoiceNumber);
      await redis.del(recordKey(invoiceNumber));
      await redis.zrem(indexKey, String(invoiceNumber));
    },
  };
  return store;
}

function notFound(invoiceNumber: number): Error & { status?: number } {
  const error = new Error(`Invoice ${invoiceNumber} não encontrada.`) as Error & { status?: number };
  error.status = 404;
  return error;
}

export function getInvoiceStore(): InvoiceStore {
  const hasRedis = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (hasRedis) return createRedisInvoiceStore();
  if (process.env.VERCEL === '1') {
    throw new Error('Configure KV_REST_API_URL e KV_REST_API_TOKEN para armazenar invoices na Vercel.');
  }
  return createLocalInvoiceStore(path.join(process.cwd(), 'data', 'invoices'));
}
