import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { InvoiceWorkspace } from '@/components/invoice-workspace';
import { AUTH_COOKIE, authenticationRequired, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoices',
  description: 'Geração e envio de invoices comerciais da GWM Informática',
};

export default async function InvoicesPage() {
  if (authenticationRequired()) {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!verifySessionToken(token)) redirect('/login');
  }
  return <InvoiceWorkspace />;
}
