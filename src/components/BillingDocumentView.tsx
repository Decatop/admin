'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowLeft, Check, FileOutput, Printer, RotateCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { BillingDocument } from '@/lib/types';
import BillingDocumentPrintout from './BillingDocumentPrintout';

interface PaymentInput {
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  note: string;
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function statusLabel(status: BillingDocument['status']): string {
  return status === 'sent' ? 'issued' : status.replaceAll('_', ' ');
}

function statusClass(status: BillingDocument['status']): string {
  if (status === 'paid' || status === 'accepted') return 'badge badge-green capitalize';
  if (status === 'overdue' || status === 'declined' || status === 'void') return 'badge bg-red-100 text-red-700 capitalize';
  if (status === 'draft') return 'badge badge-gray capitalize';
  return 'badge badge-gold capitalize';
}

export default function BillingDocumentView({ id }: { id: string }) {
  const router = useRouter();
  const [document, setDocument] = useState<BillingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const printoutRef = useRef<HTMLDivElement>(null);
  const [payment, setPayment] = useState<PaymentInput>({
    amount: 0,
    paymentDate: today(),
    method: 'Bank transfer',
    reference: '',
    note: '',
  });

  const load = useCallback(async () => {
    setError('');
    try {
      setDocument(await api.get<BillingDocument>(`/billing-documents/${encodeURIComponent(id)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(path: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      const updated = await api.post<BillingDocument>(path, body);
      setDocument(updated);
      setShowPayment(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The document could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft() {
    if (!document || !confirm(`Delete draft ${document.documentNumber}? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      await api.del(`/billing-documents/${encodeURIComponent(document.id)}`);
      router.push('/invoices');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft could not be deleted.');
      setBusy(false);
    }
  }

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/billing-documents/${encodeURIComponent(document.id)}/payments`, payment);
      setShowPayment(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  async function convertQuotation() {
    if (!document || !confirm(`Create an invoice from ${document.documentNumber}?`)) return;
    setBusy(true);
    setError('');
    try {
      const invoice = await api.post<BillingDocument>(
        `/billing-documents/${encodeURIComponent(document.id)}/convert-to-invoice`,
      );
      router.push(`/invoices/${encodeURIComponent(invoice.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quotation could not be converted.');
      setBusy(false);
    }
  }

  async function exportPdf() {
    const printout = printoutRef.current;
    if (!document || !printout) {
      setPdfError('The invoice preview is not ready to export.');
      return;
    }

    setPdfExporting(true);
    setPdfError('');
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const safeDocumentNumber = document.documentNumber.replace(/[^a-zA-Z0-9._-]+/g, '-');
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: `${document.documentType}-${safeDocumentNumber}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            allowTaint: false,
            backgroundColor: '#ffffff',
            scale: 2,
            scrollX: 0,
            scrollY: 0,
            useCORS: true,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(printout)
        .save();
    } catch (e) {
      setPdfError(e instanceof Error ? `PDF export failed: ${e.message}` : 'PDF export failed.');
    } finally {
      setPdfExporting(false);
    }
  }

  if (loading) return <p className="text-sm text-brand-muted">Loading document…</p>;
  if (!document) {
    return (
      <div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <Link href="/invoices" className="btn-ghost mt-4"><ArrowLeft size={16} /> Invoices &amp; quotes</Link>
      </div>
    );
  }

  const isInvoice = document.documentType === 'invoice';
  const canRecordPayment = isInvoice && ['sent', 'partially_paid', 'overdue'].includes(document.status);

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="btn-ghost"><ArrowLeft size={16} /> Invoices &amp; quotes</Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={busy}>
            <RotateCw size={15} /> Refresh
          </button>
          <button type="button" className="btn-primary" onClick={() => void exportPdf()} disabled={pdfExporting}>
            <ArrowDownToLine size={16} /> {pdfExporting ? 'Exporting PDF…' : 'Download PDF'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <span className={statusClass(document.status)}>{statusLabel(document.status)}</span>
          <span className="text-sm font-semibold text-brand-ink">{document.documentNumber}</span>
          {document.status === 'draft' && (
            <span className="text-xs text-brand-muted">
              Issuing locks the document for editing; printing or saving the PDF and sending it to the client is manual.
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {document.status === 'draft' && (
            <>
              <Link href={`/invoices/${encodeURIComponent(document.id)}/edit`} className="btn-ghost">Edit draft</Link>
              <button type="button" disabled={busy} onClick={() =>
                void runAction(`/billing-documents/${encodeURIComponent(document.id)}/issue`)
              } className="btn-primary">
                <Check size={16} /> Issue document
              </button>
              <button type="button" disabled={busy} onClick={() => void removeDraft()} className="btn-danger">
                <Trash2 size={16} /> Delete draft
              </button>
            </>
          )}
          {canRecordPayment && (
            <button type="button" className="btn-primary" onClick={() => {
              setPayment({ amount: document.balanceDue, paymentDate: today(), method: 'Bank transfer', reference: '', note: '' });
              setShowPayment(true);
            }}>
              <Check size={16} /> Record payment
            </button>
          )}
          {isInvoice && ['sent', 'overdue'].includes(document.status) && document.amountPaid === 0 && (
            <button type="button" disabled={busy} className="btn-danger" onClick={() => {
              if (confirm(`Void ${document.documentNumber}?`)) {
                void runAction(`/billing-documents/${encodeURIComponent(document.id)}/status`, { status: 'void' });
              }
            }}>
              Void invoice
            </button>
          )}
          {!isInvoice && document.status === 'sent' && (
            <>
              <button type="button" disabled={busy} className="btn-primary" onClick={() =>
                void runAction(`/billing-documents/${encodeURIComponent(document.id)}/status`, { status: 'accepted' })
              }>Accept quotation</button>
              <button type="button" disabled={busy} className="btn-ghost" onClick={() =>
                void runAction(`/billing-documents/${encodeURIComponent(document.id)}/status`, { status: 'declined' })
              }>Mark declined</button>
              <button type="button" disabled={busy} className="btn-ghost" onClick={() =>
                void runAction(`/billing-documents/${encodeURIComponent(document.id)}/status`, { status: 'expired' })
              }>Mark expired</button>
            </>
          )}
          {!isInvoice && document.status === 'accepted' && (
            <button type="button" disabled={busy} className="btn-primary" onClick={() => void convertQuotation()}>
              <FileOutput size={16} /> Create invoice
            </button>
          )}
          {document.convertedTo && (
            <Link href={`/invoices/${encodeURIComponent(document.convertedTo)}`} className="btn-ghost">
              View converted invoice
            </Link>
          )}
        </div>
      </div>

      {error && <p role="alert" className="no-print mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {pdfError && <p role="alert" className="no-print mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{pdfError}</p>}

      {showPayment && (
        <form onSubmit={recordPayment} className="no-print mb-5 grid gap-4 rounded-xl border border-brand-primary/20 bg-white p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-5">
            <h2 className="font-semibold text-brand-ink">Record payment</h2>
            <p className="mt-1 text-xs text-brand-muted">Balance due: ₦{document.balanceDue.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Payments cannot exceed the remaining balance.</p>
          </div>
          <div>
            <label htmlFor="payment-amount" className="label">Amount (₦)</label>
            <input id="payment-amount" type="number" required min="0.01" max={document.balanceDue} step="0.01" className="input"
              value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: Number(event.target.value) })} />
          </div>
          <div>
            <label htmlFor="payment-date" className="label">Payment date</label>
            <input id="payment-date" type="date" required className="input" value={payment.paymentDate}
              onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })} />
          </div>
          <div>
            <label htmlFor="payment-method" className="label">Method</label>
            <input id="payment-method" required maxLength={40} className="input" value={payment.method}
              onChange={(event) => setPayment({ ...payment, method: event.target.value })} />
          </div>
          <div>
            <label htmlFor="payment-reference" className="label">Reference</label>
            <input id="payment-reference" maxLength={120} className="input" value={payment.reference}
              onChange={(event) => setPayment({ ...payment, reference: event.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <label htmlFor="payment-note" className="label">Note</label>
            <input id="payment-note" maxLength={500} className="input" value={payment.note}
              onChange={(event) => setPayment({ ...payment, note: event.target.value })} placeholder="Optional" />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <button type="button" className="btn-ghost" onClick={() => setShowPayment(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Recording…' : 'Save payment'}</button>
          </div>
        </form>
      )}

      <div ref={printoutRef}>
        <BillingDocumentPrintout document={document} />
      </div>

      {isInvoice && document.payments.length > 0 && (
        <section className="no-print card mx-auto mt-5 max-w-[210mm]">
          <h2 className="text-sm font-bold text-brand-ink">Payment history</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="data-table min-w-[560px]">
              <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Note</th><th>Amount</th></tr></thead>
              <tbody>
                {document.payments.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.paymentDate}</td>
                    <td>{entry.method}</td>
                    <td>{entry.reference || '—'}</td>
                    <td>{entry.note || '—'}</td>
                    <td className="font-semibold">₦{entry.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
