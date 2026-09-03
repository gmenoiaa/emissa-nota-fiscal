'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const password = String(new FormData(event.currentTarget).get('password') || '');
    const response = await fetch('/api/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Não foi possível entrar.');
      setLoading(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="card login-card">
        <p className="eyebrow">ACESSO PROTEGIDO</p>
        <h1>Emitir NFS-e</h1>
        <p className="subtitle">Entre com a senha privada configurada para este emissor.</p>
        {configured ? (
          <form onSubmit={submit}>
            <label>Senha
              <input name="password" type="password" autoComplete="current-password" required autoFocus />
            </label>
            <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
          </form>
        ) : (
          <div className="result error">Configure APP_PASSWORD e AUTH_SECRET no ambiente da Vercel.</div>
        )}
        {error && <div className="result error" role="alert">{error}</div>}
      </section>
    </main>
  );
}

