import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE, authenticationConfigured, createSessionToken, sessionCookieOptions, verifyPassword,
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!authenticationConfigured()) {
    return Response.json({ error: 'Autenticação não configurada.' }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  if (!verifyPassword(String(body.password || ''))) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return Response.json({ error: 'Senha inválida.' }, { status: 401 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, createSessionToken(), sessionCookieOptions);
  return response;
}

