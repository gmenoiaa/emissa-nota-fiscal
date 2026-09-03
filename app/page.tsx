import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { InvoiceForm } from '@/components/invoice-form';
import { AUTH_COOKIE, authenticationRequired, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (authenticationRequired()) {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!verifySessionToken(token)) redirect('/login');
  }
  return <InvoiceForm />;
}

