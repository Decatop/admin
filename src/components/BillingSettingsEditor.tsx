'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { BillingSettings } from '@/lib/types';

export default function BillingSettingsEditor() {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<BillingSettings>('/billing-settings')
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Invoice settings could not be loaded.'));
  }, []);

  const set = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) =>
    setSettings((previous) => previous ? { ...previous, [key]: value } : previous);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      setSettings(await api.put<BillingSettings>('/billing-settings', settings));
      setMessage('Invoice settings saved. These defaults apply to new documents only.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invoice settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <p className="text-sm text-brand-muted">Loading invoice settings…</p>}
        <Link href="/invoices" className="btn-ghost mt-4">Back to invoices &amp; quotes</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Invoice settings</h1>
          <p className="page-subtitle">Configure private payment details and defaults for new invoices and quotations.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices" className="btn-ghost">Back</Link>
          <button type="button" onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {message && <p role="status" className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="card mt-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-brand-ink">Business and tax identification</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Logo, business name, address, phone, WhatsApp and email are taken from the existing business settings and
            saved as a snapshot on each new document.
          </p>
          <Link href="/settings" className="mt-2 inline-flex text-xs font-semibold text-brand-primary hover:underline">
            Edit business contact details
          </Link>
          <span className="px-2 text-xs text-brand-muted">·</span>
          <Link href="/appearance" className="inline-flex text-xs font-semibold text-brand-primary hover:underline">
            Edit company logo
          </Link>
        </div>
        <div>
          <label htmlFor="tax-identifier" className="label">Company TIN / tax identification number</label>
          <input id="tax-identifier" maxLength={100} className="input" value={settings.taxIdentifier}
            onChange={(event) => set('taxIdentifier', event.target.value)} />
        </div>
      </section>

      <section className="card mt-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-brand-ink">Document defaults</h2>
          <p className="mt-1 text-xs text-brand-muted">Defaults are copied into new drafts; existing documents are unchanged.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="default-tax-rate" className="label">Default tax / VAT rate (%)</label>
            <input id="default-tax-rate" type="number" min="0" max="100" step="0.01" className="input"
              value={settings.defaultTaxRate} onChange={(event) => set('defaultTaxRate', Number(event.target.value))} />
          </div>
          <div>
            <label htmlFor="default-due-days" className="label">Invoice payment terms (days)</label>
            <input id="default-due-days" type="number" min="0" max="365" step="1" className="input"
              value={settings.defaultDueDays} onChange={(event) => set('defaultDueDays', Number(event.target.value))} />
          </div>
          <div>
            <label htmlFor="default-validity-days" className="label">Quotation validity (days)</label>
            <input id="default-validity-days" type="number" min="1" max="365" step="1" className="input"
              value={settings.defaultQuoteValidityDays}
              onChange={(event) => set('defaultQuoteValidityDays', Number(event.target.value))} />
          </div>
        </div>
        <div>
          <label htmlFor="default-payment-instructions" className="label">Default payment instructions / bank details</label>
          <textarea id="default-payment-instructions" rows={4} maxLength={3000} className="input"
            value={settings.paymentInstructions} onChange={(event) => set('paymentInstructions', event.target.value)}
            placeholder="Bank name, account name, account number and transfer reference" />
          <p className="mt-1 text-xs text-brand-muted">These private details appear on invoices and quotations, not on the public website.</p>
        </div>
        <div>
          <label htmlFor="default-terms" className="label">Default terms and conditions</label>
          <textarea id="default-terms" rows={5} maxLength={3000} className="input" value={settings.defaultTerms}
            onChange={(event) => set('defaultTerms', event.target.value)}
            placeholder="Payment, delivery, returns, installation and quote validity terms" />
        </div>
      </section>
    </div>
  );
}
