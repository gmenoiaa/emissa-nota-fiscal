import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';

export interface DpsSequence {
  peek(): Promise<number>;
  reserve(): Promise<number>;
}

function assertSequence(value: unknown): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Sequência de DPS inválida.');
  return number;
}

export function createLocalDpsSequence(dataDirectory: string, initialValue: number): DpsSequence {
  const sequencePath = path.join(dataDirectory, 'dps-sequence.json');
  const read = () => {
    if (!fs.existsSync(sequencePath)) return initialValue;
    return assertSequence(JSON.parse(fs.readFileSync(sequencePath, 'utf8')).nextDpsNumber);
  };
  return {
    async peek() { return read(); },
    async reserve() {
      const current = read();
      fs.mkdirSync(dataDirectory, { recursive: true });
      const temporaryPath = `${sequencePath}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify({ nextDpsNumber: current + 1 }, null, 2), { mode: 0o600 });
      fs.renameSync(temporaryPath, sequencePath);
      return current;
    },
  };
}

export function createRedisDpsSequence(initialValue: number): DpsSequence {
  const redis = Redis.fromEnv();
  const key = process.env.NFSE_DPS_SEQUENCE_KEY || 'nfse:next-dps-number';
  const initialize = async () => { await redis.setnx(key, initialValue); };
  return {
    async peek() {
      await initialize();
      return assertSequence(await redis.get<number>(key));
    },
    async reserve() {
      await initialize();
      const next = assertSequence(await redis.incr(key));
      return next - 1;
    },
  };
}

export function getDpsSequence(initialValue: number): DpsSequence {
  const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (hasRedis) return createRedisDpsSequence(initialValue);
  if (process.env.VERCEL === '1') {
    throw new Error('Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para numerar DPS na Vercel.');
  }
  return createLocalDpsSequence(path.join(process.cwd(), 'data'), initialValue);
}

