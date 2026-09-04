'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, type ApiError } from '@/lib/client-api';
import type { InvoiceRecord } from '@/lib/types';

interface InvoiceCustomerDefaults {
  id: string;
  name: string;
  currencyCode: string;
  rate: string;
  lineItemDescription: string;
  billingAddress: string[];
  emailTo: string[];
  sendByDefault: boolean;
}

interface InvoiceWorkspaceData {
  records: InvoiceRecord[];
  total: number;
  nextNumber: number | null;
  sequenceError?: string;
  today: string;
  defaultReferencePeriod: string;
  customers: InvoiceCustomerDefaults[];
  email: { configured: boolean; testMode: boolean; testRecipient: string | null; from: string };
}

function formatMoney(value: string, currencyCode: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(Number(value));
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const STATUS_LABELS: Record<InvoiceRecord['status'], string> = {
  issued: 'Emitida',
  paid: 'Paga',
  void: 'Cancelada',
};

export function InvoiceWorkspace() {
  const [data, setData] = useState<InvoiceWorkspaceData | null>(null);
  const [customerId, setCustomerId] = useState('apideck');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setData(await api<InvoiceWorkspaceData>('/api/invoices'));
  }

  useEffect(() => {
    refresh().catch((error: Error) => setMessage({ text: error.message, error: true }));
  }, []);

  const customer = useMemo(
    () => data?.customers.find(({ id }) => id === customerId) || data?.customers[0],
    [customerId, data],
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy('create');
    setMessage({ text: 'Gerando invoice…' });
    try {
      const { record } = await api<{ record: InvoiceRecord }>('/api/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: values.get('customerId'),
          lineItemDescription: values.get('lineItemDescription'),
          quantity: values.get('quantity'),
          rate: values.get('rate'),
          issueDate: values.get('issueDate'),
          dueDate: values.get('dueDate'),
          referencePeriod: values.get('referencePeriod'),
        }),
      });
      setMessage({ text: `${record.reference} gerada. Baixe o PDF ou envie por e-mail na lista abaixo.` });
      await refresh();
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail(record: InvoiceRecord, options: { confirmResend?: boolean; test?: boolean } = {}) {
    const { confirmResend = false, test = false } = options;
    const customerRecipients = data?.customers.find(({ id }) => id === record.customerId)?.emailTo || [];
    if (!test && customerRecipients.length && !window.confirm(
      `Enviar ${record.reference} para ${customerRecipients.join(', ')}?\n\nEste e-mail vai para o cliente.`,
    )) return;

    setBusy(`${test ? 'test' : 'email'}-${record.number}`);
    setMessage({ text: `Enviando ${record.reference}…` });
    try {
      await api<{ record: InvoiceRecord }>(`/api/invoices/${record.number}/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmResend, test }),
      });
      setMessage({
        text: test
          ? `Teste de ${record.reference} enviado para ${data?.email.testRecipient}. A invoice continua sem envio ao cliente.`
          : `${record.reference} enviada por e-mail.`,
      });
      if (!test) await refresh();
    } catch (error) {
      const failure = error as ApiError;
      if (failure.status === 409 && window.confirm(`${failure.message}\n\nReenviar mesmo assim?`)) {
        await sendEmail(record, { confirmResend: true });
        return;
      }
      setMessage({ text: failure.message, error: true });
    } finally {
      setBusy(null);
    }
  }

  async function removeInvoice(record: InvoiceRecord) {
    if (!window.confirm(
      `Excluir ${record.reference} definitivamente?\n\nO registro some e o número volta para a sequência se for o último gerado.`,
    )) return;
    setBusy(`delete-${record.number}`);
    try {
      const result = await api<{ numberReclaimed: boolean }>(`/api/invoices/${record.number}`, { method: 'DELETE' });
      setMessage({
        text: `${record.reference} excluída.${
          result.numberReclaimed ? ` O número ${record.number} volta a ser o próximo.` : ''
        }`,
      });
      await refresh();
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(record: InvoiceRecord, status: InvoiceRecord['status']) {
    if (status === 'void' && !window.confirm(
      `Cancelar ${record.reference}?\n\nO registro e o número são mantidos, mas a invoice não poderá mais ser enviada.`,
    )) return;
    setBusy(`status-${record.number}`);
    try {
      await api<{ record: InvoiceRecord }>(`/api/invoices/${record.number}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await refresh();
      setMessage({ text: `${record.reference} marcada como ${STATUS_LABELS[status].toLowerCase()}.` });
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  const emailHint = !data?.email.configured
    ? 'e-mail não configurado'
    : data.email.testMode
      ? `e-mail em teste → ${data.email.testRecipient}`
      : `envio real · ${data.email.from.replace(/^.*<|>$/g, '')}`;

  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">GWM INFORMÁTICA · MARINGÁ</p>
          <h1>Invoices</h1>
          <p className="subtitle">Gere a invoice do cliente, baixe o PDF e envie por e-mail.</p>
        </div>
        <div className="status">
          {data
            ? `${data.nextNumber ? `Próxima INV-${data.nextNumber}` : 'sem sequência'} · ${emailHint}`
            : 'Carregando…'}
        </div>
      </header>

      <nav className="tabs">
        <a href="/">Emitir NFS-e</a>
        <a href="/invoices" className="active" aria-current="page">Invoices</a>
      </nav>

      <section className="card">
        <form onSubmit={create}>
          <label>Empresa
            <select name="customerId" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
              {data?.customers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>

          <div className="customer-card">
            <span className="customer-badge">{customer?.currencyCode || '—'}</span>
            <strong>{customer?.name || 'Carregando…'}</strong>
            <p>{customer?.billingAddress.join(' · ') || 'Carregando endereço…'}</p>
            <small>
              {customer?.emailTo.length
                ? `E-mail do cliente: ${customer.emailTo.join(', ')}`
                : 'Sem e-mail cadastrado — esta empresa só gera o PDF.'}
            </small>
          </div>

          {customer && (
            <>
              <label>Descrição do serviço
                <input name="lineItemDescription" defaultValue={customer.lineItemDescription} key={`d-${customer.id}`} required />
              </label>

              <div className="grid">
                <label>Quantidade
                  <input name="quantity" inputMode="decimal" defaultValue="1" key={`q-${customer.id}`} required />
                </label>
                <label>Rate ({customer.currencyCode})
                  <input name="rate" inputMode="decimal" defaultValue={customer.rate} key={`r-${customer.id}`} required />
                </label>
              </div>

              <div className="grid three">
                <label>Data
                  <input name="issueDate" type="date" defaultValue={data?.today} key={`i-${data?.today}`} required />
                </label>
                <label>Vencimento
                  <input name="dueDate" type="date" defaultValue={data?.today} key={`v-${data?.today}`} required />
                </label>
                <label>Referência
                  <input name="referencePeriod" defaultValue={data?.defaultReferencePeriod} key={`p-${data?.defaultReferencePeriod}`} required />
                </label>
              </div>
            </>
          )}

          {data?.sequenceError && <div className="result error">{data.sequenceError}</div>}
          <div className="actions">
            <button type="submit" disabled={busy === 'create' || !data || Boolean(data?.sequenceError)}>
              {busy === 'create' ? 'Gerando…' : 'Gerar invoice'}
            </button>
          </div>
        </form>
      </section>

      {message && <section className={`card result ${message.error ? 'error' : ''}`} role="status">{message.text}</section>}

      <section className="card list-card">
        <div className="list-head">
          <h2>Invoices geradas</h2>
          <span className="count">{data ? `${data.total} no total` : '—'}</span>
        </div>

        {data && data.records.length === 0 && <p className="empty">Nenhuma invoice gerada ainda.</p>}

        {data && data.records.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th><th>Empresa</th><th>Data</th><th className="right">Total</th>
                  <th>Status</th><th>E-mail</th><th>NFS-e</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.number}>
                    <td><strong>{record.reference}</strong></td>
                    <td>{record.customerName}</td>
                    <td>{formatDate(record.issueDate)}</td>
                    <td className="right">{formatMoney(record.total, record.currencyCode)}</td>
                    <td><span className={`badge ${record.status}`}>{STATUS_LABELS[record.status]}</span></td>
                    <td>{record.email ? <span className="badge sent">Enviada</span> : <span className="badge muted">—</span>}</td>
                    <td>
                      {record.nfse
                        ? <span className="badge sent">DPS {record.nfse.dpsNumber}</span>
                        : <a className="link" href={`/?invoice=${record.reference}&customer=${record.customerId}`}>Emitir</a>}
                    </td>
                    <td className="right actions-cell"><div className="row-actions">
                      <a className="link" href={`/api/invoices/${record.number}/pdf`}>PDF</a>
                      {data.email.configured && record.status !== 'void' && (
                        <>
                          <button type="button" className="link-button quiet-action" disabled={busy === `test-${record.number}`}
                            onClick={() => sendEmail(record, { test: true })}>
                            {busy === `test-${record.number}` ? 'Testando…' : 'Testar'}
                          </button>
                          <button type="button" className="link-button" disabled={busy === `email-${record.number}`}
                            onClick={() => sendEmail(record)}>
                            {busy === `email-${record.number}` ? 'Enviando…' : record.email ? 'Reenviar' : 'Enviar'}
                          </button>
                        </>
                      )}
                      {record.status === 'issued' && (
                        <button type="button" className="link-button" disabled={busy === `status-${record.number}`}
                          onClick={() => changeStatus(record, 'paid')}>Marcar paga</button>
                      )}
                      {record.status !== 'void' && (
                        <button type="button" className="link-button danger" disabled={busy === `status-${record.number}`}
                          onClick={() => changeStatus(record, 'void')}>Cancelar</button>
                      )}
                      {!record.email && !record.nfse && (
                        <button type="button" className="link-button danger" disabled={busy === `delete-${record.number}`}
                          onClick={() => removeInvoice(record)}>
                          {busy === `delete-${record.number}` ? 'Excluindo…' : 'Excluir'}
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
