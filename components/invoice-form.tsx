'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

interface PublicCustomer {
  id: string;
  name: string;
  currencyCode: string;
  foreignAmount: string;
  displayAddress: string;
  countryName: string;
}

interface Status {
  environment: 'restricted' | 'production';
  certificateConfigured: boolean;
  productionEnabled: boolean;
  nextDpsNumber: number | null;
  sequenceError?: string;
  authenticationRequired: boolean;
  customers: PublicCustomer[];
}

interface FormPayload {
  customerId: string;
  amount: string;
  description: string;
  confirmProduction: boolean;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error('Sessão expirada.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.details ? `${data.error}\n${JSON.stringify(data.details, null, 2)}` : data.error);
  return data;
}

function downloadXml(xml: string, filename: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function InvoiceForm() {
  const [status, setStatus] = useState<Status | null>(null);
  const [customerId, setCustomerId] = useState('apideck');
  const [preview, setPreview] = useState<{ dpsNumber: number; xml: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Status>('/api/status').then(setStatus).catch((error: Error) => setMessage({ text: error.message, error: true }));
  }, []);

  const customer = useMemo(
    () => status?.customers.find(({ id }) => id === customerId) || status?.customers[0],
    [customerId, status],
  );
  const foreignAmount = customer
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: customer.currencyCode }).format(Number(customer.foreignAmount))
    : '—';

  function formPayload(form: HTMLFormElement): FormPayload {
    const data = new FormData(form);
    return {
      customerId: String(data.get('customerId') || ''),
      amount: String(data.get('amount') || ''),
      description: String(data.get('description') || ''),
      confirmProduction: data.get('confirmProduction') === 'on',
    };
  }

  async function showPreview(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form?.reportValidity()) return;
    try {
      const data = await api<{ dpsNumber: number; xml: string }>('/api/preview', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(formPayload(form)),
      });
      setPreview(data);
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    }
  }

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage({ text: 'Preparando, assinando e enviando a DPS…' });
    try {
      const data = await api<{ dpsNumber: number; accessKey: string | null; nfseXml: string | null }>('/api/issue', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(formPayload(event.currentTarget)),
      });
      if (data.nfseXml) downloadXml(data.nfseXml, `${data.accessKey || `DPS-${data.dpsNumber}`}.xml`);
      setMessage({ text: `NFS-e emitida com sucesso. DPS ${data.dpsNumber}${data.accessKey ? ` · chave ${data.accessKey}` : ''}. O XML foi baixado neste dispositivo.` });
      const refreshed = await api<Status>('/api/status');
      setStatus(refreshed);
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    } finally {
      setLoading(false);
    }
  }

  const production = status?.environment === 'production';
  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">GWM INFORMÁTICA · MARINGÁ</p>
          <h1>Emitir NFS-e</h1>
          <p className="subtitle">Os parâmetros fiscais recorrentes já estão configurados.</p>
        </div>
        <div className={`status ${production ? 'production' : ''}`}>
          {status
            ? `${production ? 'Produção' : 'Teste restrito'} · ${status.nextDpsNumber ? `DPS ${status.nextDpsNumber}` : 'sem sequência'} · ${status.certificateConfigured ? 'certificado pronto' : 'sem certificado'}`
            : 'Verificando ambiente…'}
        </div>
      </header>

      <section className="card">
        <form onSubmit={issue}>
          <label>Empresa
            <select name="customerId" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
              {status?.customers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>

          <div className="customer-card">
            <span className="customer-badge">{customer?.currencyCode || '—'}</span>
            <strong>{customer?.name || 'Carregando…'}</strong>
            <p>{customer?.displayAddress || 'Carregando endereço…'}</p>
            <small>Valor da invoice no modelo: {foreignAmount}</small>
          </div>

          <div className="grid">
            <label>Valor em reais
              <div className="money"><span>R$</span><input name="amount" inputMode="decimal" placeholder="37.204,60" required /></div>
            </label>
            <label>Descrição / invoice
              <input name="description" placeholder="INV-1034" required />
            </label>
          </div>

          <details>
            <summary>Revisar parâmetros fixos</summary>
            <dl>
              <div><dt>Serviço</dt><dd>080201 · Treinamento e orientação</dd></div>
              <div><dt>Município</dt><dd>Maringá · 4115200</dd></div>
              <div><dt>Destino</dt><dd>Exportação · {customer?.countryName || '—'}</dd></div>
              <div><dt>Moeda estrangeira</dt><dd>{customer?.currencyCode || '—'} · {foreignAmount}</dd></div>
              <div><dt>Mecanismo de pagamento</dt><dd>01 · exemplo mais recente</dd></div>
              <div><dt>Tributos aproximados</dt><dd>6,00%</dd></div>
            </dl>
          </details>

          {production && (
            <div className="production-warning">
              <label className="checkbox"><input type="checkbox" name="confirmProduction" required /> Confirmo que esta NFS-e deve ser emitida em produção.</label>
            </div>
          )}

          {status?.sequenceError && <div className="result error">{status.sequenceError}</div>}
          <div className="actions">
            {status?.authenticationRequired && <button type="button" className="quiet" onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => window.location.assign('/login'))}>Sair</button>}
            <button type="button" className="secondary" onClick={showPreview}>Revisar DPS</button>
            <button type="submit" disabled={loading || !status?.certificateConfigured || Boolean(status?.sequenceError)}>
              {loading ? 'Emitindo…' : status?.certificateConfigured ? 'Emitir NFS-e' : 'Configure o certificado'}
            </button>
          </div>
        </form>
      </section>

      {message && <section className={`card result ${message.error ? 'error' : ''}`} role="status">{message.text}</section>}

      {preview && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPreview(null)}>
          <dialog open aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-head"><h2 id="preview-title">DPS {preview.dpsNumber} preparada</h2><button type="button" className="close" aria-label="Fechar" onClick={() => setPreview(null)}>×</button></div>
            <p>Confira os dados. A assinatura digital será adicionada somente na emissão.</p>
            <pre>{preview.xml}</pre>
          </dialog>
        </div>
      )}
    </main>
  );
}
