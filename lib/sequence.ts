import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import { fixedInvoice } from './invoice-config';

export interface Counter {
  peek(): Promise<number>;
  reserve(): Promise<number>;
}

/** Kept as an alias so existing DPS call sites read the same as before. */
export type DpsSequence = Counter;

export interface CounterOptions {
  /** File that holds the counter when Redis is not configured. */
  filePath: string;
  /** JSON property inside that file, so each counter keeps its own readable shape. */
  field: string;
  /** Redis key used on Vercel. */
  key: string;
  initialValue: number;
  /** Used in error messages so a failure names the sequence that broke. */
  label: string;
}

function assertSequence(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`Sequência de ${label} inválida.`);
  return number;
}

export function createLocalCounter(options: Omit<CounterOptions, 'key'>): Counter {
  const { filePath, field, initialValue, label } = options;
  const read = () => {
    if (!fs.existsSync(filePath)) return initialValue;
    return assertSequence(JSON.parse(fs.readFileSync(filePath, 'utf8'))[field], label);
  };
  return {
    async peek() { return read(); },
    async reserve() {
      const current = read();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify({ [field]: current + 1 }, null, 2), { mode: 0o600 });
      fs.renameSync(temporaryPath, filePath);
      return current;
    },
  };
}

export function createRedisCounter(options: Omit<CounterOptions, 'filePath' | 'field'>): Counter {
  const { key, initialValue, label } = options;
  const redis = Redis.fromEnv();
  const initialize = async () => { await redis.setnx(key, initialValue); };
  return {
    async peek() {
      await initialize();
      return assertSequence(await redis.get<number>(key), label);
    },
    async reserve() {
      await initialize();
      const next = assertSequence(await redis.incr(key), label);
      return next - 1;
    },
  };
}

export function getCounter(options: CounterOptions): Counter {
  const hasRedis = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (hasRedis) return createRedisCounter(options);
  if (process.env.VERCEL === '1') {
    throw new Error(`Configure KV_REST_API_URL e KV_REST_API_TOKEN para numerar ${options.label} na Vercel.`);
  }
  return createLocalCounter(options);
}

function dpsRedisKey(): string {
  const paddedSeries = fixedInvoice.series.padStart(5, '0');
  const configuredKey = process.env.NFSE_DPS_SEQUENCE_KEY?.trim();
  return configuredKey && configuredKey !== 'nfse:next-dps-number'
    ? configuredKey
    : `nfse:${fixedInvoice.providerCnpj}:${paddedSeries}:next-dps-number`;
}

function dpsCounterOptions(initialValue: number): CounterOptions {
  return {
    filePath: path.join(process.cwd(), 'data', 'dps-sequence.json'),
    field: 'nextDpsNumber',
    key: dpsRedisKey(),
    initialValue,
    label: 'DPS',
  };
}

export function createLocalDpsSequence(dataDirectory: string, initialValue: number): DpsSequence {
  return createLocalCounter({
    filePath: path.join(dataDirectory, 'dps-sequence.json'),
    field: 'nextDpsNumber',
    initialValue,
    label: 'DPS',
  });
}

export function createRedisDpsSequence(initialValue: number): DpsSequence {
  return createRedisCounter({ key: dpsRedisKey(), initialValue, label: 'DPS' });
}

export function getDpsSequence(initialValue: number): DpsSequence {
  return getCounter(dpsCounterOptions(initialValue));
}
