'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  BillingDocument,
  BillingDocumentInput,
  BillingDocumentType,
  BillingLineItemInput,
  BillingSettings,
  SiteSettings,
} from '@/lib/types';

function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateAfter(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00`);
  result.setDate(result.getDate() + days);
  return localDate(result);
}

function newDraft(documentType: BillingDocumentType, settings: BillingSettings): BillingDocumentInput {
  const issueDate = localDate();
  return {
    documentType,
    clientName: '',
    clientEmail: null,
    clientPhone: null,
    clientTaxId: '',
    clientReference: '',
    clientAddress: '',
    issueDate,
    dueDate: documentType === 'invoice' ? dateAfter(issueDate, settings.defaultDueDays) : null,
    validUntil:
      documentType === 'quotation' ? dateAfter(issueDate, settings.defaultQuoteValidityDays) : null,
    lineItems: [{ description: '', quantity: 1, unit: 'piece', unitPrice: 0 }],
    discountType: 'fixed',
    discountValue: 0,
    shippingAmount: 0,
    taxLabel: 'VAT',
    taxRate: settings.defaultTaxRate,
    paymentInstructions: settings.paymentInstructions,
    notes: '',
    terms: settings.defaultTerms,
  };
}

function toInput(document: BillingDocument): BillingDocumentInput {
  return {
    documentType: document.documentType,
    clientName: document.clientName,
    clientEmail: document.clientEmail,
    clientPhone: document.clientPhone,
    clientTaxId: document.clientTaxId,
    clientReference: document.clientReference,
    clientAddress: document.clientAddress,
    issueDate: document.issueDate,
    dueDate: document.dueDate,
    validUntil: document.validUntil,
    lineItems: document.lineItems.map(({ description, quantity, unit, unitPrice }) => ({
      description,
      quantity,
      unit,
      unitPrice,
    })),
    discountType: document.discountType,
    discountValue: document.discountValue,
    shippingAmount: document.shippingAmount,
    taxLabel: document.taxLabel,
    taxRate: document.taxRate,
    paymentInstructions: document.paymentInstructions,
    notes: document.notes,
    terms: document.terms,
  };
}

function money(value: number): string {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function previewTotals(document: BillingDocumentInput) {
  const subtotalCents = document.lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100),
    0,
  );
  const discountCents =
    document.discountType === 'percent'
      ? Math.round((subtotalCents * document.discountValue) / 100)
      : Math.round(document.discountValue * 100);
  const taxableCents = Math.max(0, subtotalCents - discountCents) + Math.round(document.shippingAmount * 100);
  const taxCents = Math.round((taxableCents * document.taxRate) / 100);
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    tax: taxCents / 100,
    total: (taxableCents + taxCents) / 100,
  };
}

function companyDetailsIncomplete(settings: SiteSettings): boolean {
  return !settings.logo_url ||
    !settings.business_name ||
    (!settings.phone && !settings.whatsapp) ||
    (!settings.address && !settings.city);
}

export default function BillingDocumentEditor({
  id,
  documentType = 'invoice',
}: {
  id?: string;
  documentType?: BillingDocumentType;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BillingDocumentInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companyWarning, setCompanyWarning] = useState(false);
  const totals = useMemo(() => (form ? previewTotals(form) : null), [form]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (id) {
          const document = await api.get<BillingDocument>(`/billing-documents/${encodeURIComponent(id)}`);
          if (document.status !== 'draft') {
            router.replace(`/invoices/${encodeURIComponent(id)}`);
            return;
          }
          if (active) {
            setForm(toInput(document));
            setCompanyWarning(
              !document.company.logoUrl ||
              (!document.company.phone && !document.company.whatsapp) ||
              document.company.addressLines.length === 0,
            );
          }
        } else {
          const [settings, company] = await Promise.all([
            api.get<BillingSettings>('/billing-settings'),
            api.get<SiteSettings>('/site-settings'),
          ]);
          if (active) {
            setForm(newDraft(documentType, settings));
            setCompanyWarning(companyDetailsIncomplete(company));
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Invoice details could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, documentType, router]);

  const setField = <K extends keyof BillingDocumentInput>(key: K, value: BillingDocumentInput[K]) =>
    setForm((previous) => (previous ? { ...previous, [key]: value } : previous));

  const updateLine = (index: number, patch: Partial<BillingLineItemInput>) =>
    setForm((previous) =>
      previous
        ? {
            ...previous,
            lineItems: previous.lineItems.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item,
            ),
          }
        : previous,
    );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const saved = id
        ? await api.put<BillingDocument>(`/billing-documents/${encodeURIComponent(id)}`, form)
        : await api.post<BillingDocument>('/billing-documents', form);
      router.push(`/invoices/${encodeURIComponent(saved.id)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-brand-muted">Loading document form…</p>;
  if (!form) {
    return (
      <div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {companyWarning && (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Company logo, address or phone details are incomplete. Update <Link href="/appearance" className="font-semibold underline">the logo</Link> and{' '}
            <Link href="/settings" className="font-semibold underline">business details</Link>; saving a draft refreshes its company details.
          </p>
        )}
        <Link href="/invoices" className="btn-ghost mt-4">Back to invoices &amp; quotes</Link>
      </div>
    );
  }

  const label = form.documentType === 'invoice' ? 'Invoice' : 'Quotation';

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{id ? `Edit draft ${label.toLowerCase()}` : `New ${label.toLowerCase()}`}</h1>
          <p className="page-subtitle">A document number is assigned when you save the draft.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={id ? `/invoices/${encodeURIComponent(id)}` : '/invoices'} className="btn-ghost">
            Cancel
          </Link>
          <Link href="/invoices/settings" className="btn-ghost">
            <Settings2 size={16} /> Invoice settings
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="card space-y-4">
        <h2 className="text-sm font-bold text-brand-ink">Client details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="client-name" className="label">Client / business name *</label>
            <input id="client-name" required maxLength={200} className="input" value={form.clientName}
              onChange={(event) => setField('clientName', event.target.value)} />
          </div>
          <div>
            <label htmlFor="client-email" className="label">Email</label>
            <input id="client-email" type="email" maxLength={200} className="input" value={form.clientEmail ?? ''}
              onChange={(event) => setField('clientEmail', event.target.value || null)} />
          </div>
          <div>
            <label htmlFor="client-phone" className="label">Phone</label>
            <input id="client-phone" maxLength={60} className="input" value={form.clientPhone ?? ''}
              onChange={(event) => setField('clientPhone', event.target.value || null)} />
          </div>
          <div>
            <label htmlFor="client-tax-id" className="label">Client TIN / tax ID (optional)</label>
            <input id="client-tax-id" maxLength={100} className="input" value={form.clientTaxId}
              onChange={(event) => setField('clientTaxId', event.target.value)} />
          </div>
          <div>
            <label htmlFor="client-reference" className="label">PO / project reference (optional)</label>
            <input id="client-reference" maxLength={120} className="input" value={form.clientReference}
              onChange={(event) => setField('clientReference', event.target.value)} />
          </div>
          <div>
            <label htmlFor="client-address" className="label">Billing / delivery address</label>
            <textarea id="client-address" rows={2} maxLength={1000} className="input" value={form.clientAddress}
              onChange={(event) => setField('clientAddress', event.target.value)} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-sm font-bold text-brand-ink">Document dates</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="issue-date" className="label">Issue date *</label>
            <input id="issue-date" type="date" required className="input" value={form.issueDate}
              onChange={(event) => setField('issueDate', event.target.value)} />
          </div>
          {form.documentType === 'invoice' ? (
            <div>
              <label htmlFor="due-date" className="label">Payment due date</label>
              <input id="due-date" type="date" min={form.issueDate} className="input" value={form.dueDate ?? ''}
                onChange={(event) => setField('dueDate', event.target.value || null)} />
            </div>
          ) : (
            <div>
              <label htmlFor="valid-until" className="label">Quotation valid until *</label>
              <input id="valid-until" type="date" required min={form.issueDate} className="input"
                value={form.validUntil ?? ''} onChange={(event) => setField('validUntil', event.target.value || null)} />
            </div>
          )}
          <div className="flex items-end text-xs leading-relaxed text-brand-muted">
            Dates and the generated document number are saved with this draft.
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-brand-ink">Items and services</h2>
            <p className="mt-1 text-xs text-brand-muted">Enter a description, quantity, unit and unit price for each line.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() =>
            setField('lineItems', [...form.lineItems, { description: '', quantity: 1, unit: 'piece', unitPrice: 0 }])
          }>
            <Plus size={16} /> Add line
          </button>
        </div>

        <div className="space-y-3">
          {form.lineItems.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-black/5 p-3 sm:grid-cols-[minmax(180px,1fr)_100px_110px_140px_auto] sm:items-end">
              <div>
                <label htmlFor={`line-description-${index}`} className="label">Description *</label>
                <input id={`line-description-${index}`} required maxLength={240} className="input" value={item.description}
                  onChange={(event) => updateLine(index, { description: event.target.value })} />
              </div>
              <div>
                <label htmlFor={`line-quantity-${index}`} className="label">Quantity *</label>
                <input id={`line-quantity-${index}`} type="number" required min="0.001" step="0.001" className="input"
                  value={item.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} />
              </div>
              <div>
                <label htmlFor={`line-unit-${index}`} className="label">Unit *</label>
                <input id={`line-unit-${index}`} required maxLength={40} className="input" value={item.unit}
                  onChange={(event) => updateLine(index, { unit: event.target.value })} placeholder="piece" />
              </div>
              <div>
                <label htmlFor={`line-price-${index}`} className="label">Unit price (₦) *</label>
                <input id={`line-price-${index}`} type="number" required min="0" step="0.01" className="input"
                  value={item.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} />
              </div>
              <button type="button" disabled={form.lineItems.length <= 1} aria-label={`Remove line ${index + 1}`}
                onClick={() => setField('lineItems', form.lineItems.filter((_, itemIndex) => itemIndex !== index))}
                className="btn-danger h-10 px-3">
                <Trash2 size={16} />
              </button>
              <p className="text-right text-xs font-semibold text-brand-muted sm:col-span-5">
                Line total: {money(item.quantity * item.unitPrice)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-brand-ink">Payment, notes and terms</h2>
          <div>
            <label htmlFor="payment-instructions" className="label">Payment instructions / bank details</label>
            <textarea id="payment-instructions" rows={4} maxLength={3000} className="input"
              value={form.paymentInstructions} onChange={(event) => setField('paymentInstructions', event.target.value)}
              placeholder="Bank name, account name, account number and transfer reference" />
          </div>
          <div>
            <label htmlFor="document-notes" className="label">Notes for the client</label>
            <textarea id="document-notes" rows={3} maxLength={2000} className="input" value={form.notes}
              onChange={(event) => setField('notes', event.target.value)} placeholder="Optional notes or project details" />
          </div>
          <div>
            <label htmlFor="document-terms" className="label">Terms and conditions</label>
            <textarea id="document-terms" rows={4} maxLength={3000} className="input" value={form.terms}
              onChange={(event) => setField('terms', event.target.value)} placeholder="Payment, delivery, returns or quotation terms" />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-brand-ink">Adjustments and tax</h2>
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <div>
              <label htmlFor="discount-type" className="label">Discount type</label>
              <select id="discount-type" className="input" value={form.discountType}
                onChange={(event) => setField('discountType', event.target.value as BillingDocumentInput['discountType'])}>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percentage</option>
              </select>
            </div>
            <div>
              <label htmlFor="discount-value" className="label">{form.discountType === 'percent' ? 'Percent' : 'Amount (₦)'}</label>
              <input id="discount-value" type="number" min="0" max={form.discountType === 'percent' ? 100 : undefined}
                step="0.01" className="input" value={form.discountValue}
                onChange={(event) => setField('discountValue', Number(event.target.value))} />
            </div>
          </div>
          <div>
            <label htmlFor="shipping-amount" className="label">Delivery / shipping (₦)</label>
            <input id="shipping-amount" type="number" min="0" step="0.01" className="input" value={form.shippingAmount}
              onChange={(event) => setField('shippingAmount', Number(event.target.value))} />
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <label htmlFor="tax-label" className="label">Tax label</label>
              <input id="tax-label" required maxLength={40} className="input" value={form.taxLabel}
                onChange={(event) => setField('taxLabel', event.target.value)} />
            </div>
            <div>
              <label htmlFor="tax-rate" className="label">Rate (%)</label>
              <input id="tax-rate" type="number" min="0" max="100" step="0.01" className="input" value={form.taxRate}
                onChange={(event) => setField('taxRate', Number(event.target.value))} />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-brand-muted">Tax is calculated after discount and delivery. Confirm the applicable tax rate before issuing.</p>
          {totals && (
            <dl className="space-y-2 border-t border-black/5 pt-4 text-sm">
              <div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Discount</dt><dd>−{money(totals.discount)}</dd></div>
              <div className="flex justify-between gap-3"><dt>{form.taxLabel || 'Tax'}</dt><dd>{money(totals.tax)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-black/5 pt-2 text-base font-bold">
                <dt>Total (NGN)</dt><dd>{money(totals.total)}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link href={id ? `/invoices/${encodeURIComponent(id)}` : '/invoices'} className="btn-ghost">Cancel</Link>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save draft'}</button>
      </div>
    </form>
  );
}
