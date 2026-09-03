import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'nfse_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET não configurado.');
  return secret;
}

function signature(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authenticationRequired(): boolean {
  return process.env.VERCEL === '1' || Boolean(process.env.APP_PASSWORD);
}

export function authenticationConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD || '';
  return Boolean(expected) && safeEqual(password, expected);
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = String(Math.floor(now / 1000) + SESSION_DURATION_SECONDS);
  return `${expiresAt}.${signature(expiresAt)}`;
}

export function verifySessionToken(token?: string): boolean {
  if (!authenticationRequired()) return true;
  if (!authenticationConfigured() || !token) return false;
  const [expiresAt, suppliedSignature] = token.split('.');
  if (!expiresAt || !suppliedSignature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(suppliedSignature, signature(expiresAt));
}

export function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function requireApiAuthentication(request: Request): void {
  if (!verifySessionToken(readCookie(request, AUTH_COOKIE))) {
    const error = new Error('Sessão não autorizada.') as Error & { status?: number };
    error.status = 401;
    throw error;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DURATION_SECONDS,
};

