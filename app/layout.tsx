import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Emitir NFS-e',
  description: 'Emissão segura de NFS-e para GWM Informática',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

