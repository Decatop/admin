'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { BillingDocument, BillingDocumentType } from '@/lib/types';

type TypeFilter = 'all' | BillingDocumentType;
type StatusFilter = 'all' | BillingDocument['status'];

function formatNaira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function badge(status: BillingDocument['status']): string {
  if (['paid', 'accepted'].includes(status)) return 'badge badge-green';
  if (status === 'overdue' || status === 'declined' || status === 'void') return 'badge bg-red-100 text-red-700';
  if (status === 'draft') return 'badge badge-gray';
  return 'badge badge-gold';
}

export default function BillingDocumentsPage() {
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  useEffect(() => {
    api.get<BillingDocument[]>('/billing-documents')
      .then(setDocuments)
      .catch((e) => setError(e instanceof Error ? e.message : 'Invoices and quotations could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) =>
      (type === 'all' || document.documentType === type) &&
      (status === 'all' || document.status === status) &&
      (!query || `${document.documentNumber} ${document.clientName} ${document.clientEmail ?? ''}`.toLowerCase().includes(query)),
    );
  }, [documents, search, type, status]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Invoices &amp; quotations</h1>
          <p className="page-subtitle">Create client documents, record invoice payments, and print or save as PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices/settings" className="btn-ghost"><Settings2 size={16} /> Invoice settings</Link>
          <Link href="/invoices/new?type=quotation" className="btn-ghost"><Plus size={16} /> New quotation</Link>
          <Link href="/invoices/new?type=invoice" className="btn-primary"><Plus size={16} /> New invoice</Link>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search documents</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
          <input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Search number, client or email" />
        </label>
        <select aria-label="Filter by document type" className="input sm:w-44" value={type}
          onChange={(event) => setType(event.target.value as TypeFilter)}>
          <option value="all">All documents</option>
          <option value="invoice">Invoices</option>
          <option value="quotation">Quotations</option>
        </select>
        <select aria-label="Filter by status" className="input sm:w-44" value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">All statuses</option>
          {['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'accepted', 'declined', 'expired', 'converted', 'void'].map((value) => (
            <option key={value} value={value}>{value === 'sent' ? 'issued' : value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden border border-black/5 bg-white shadow-soft">
        {loading ? (
          <p className="p-6 text-sm text-brand-muted">Loading invoices and quotations…</p>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={30} className="mx-auto text-brand-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-brand-ink">{documents.length ? 'No matching documents' : 'No documents yet'}</p>
            <p className="mt-1 text-sm text-brand-muted">
              {documents.length ? 'Try another search or filter.' : 'Create an invoice or quotation for your first client.'}
            </p>
            {!documents.length && (
              <Link href="/invoices/new?type=invoice" className="btn-primary mt-5 inline-flex"><Plus size={16} /> New invoice</Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Client</th>
                  <th>Issue date</th>
                  <th>Due / valid until</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <Link href={`/invoices/${encodeURIComponent(document.id)}`} className="font-semibold text-brand-primary hover:underline">
                        {document.documentNumber}
                      </Link>
                      <p className="mt-1 text-xs capitalize text-brand-muted">{document.documentType}</p>
                    </td>
                    <td>
                      <p className="font-medium text-brand-ink">{document.clientName}</p>
                      {document.clientEmail && <p className="mt-1 text-xs text-brand-muted">{document.clientEmail}</p>}
                    </td>
                    <td className="text-brand-muted">{formatDate(document.issueDate)}</td>
                    <td className="text-brand-muted">
                      {formatDate(document.documentType === 'invoice' ? document.dueDate : document.validUntil)}
                    </td>
                    <td className="font-semibold tabular-nums text-brand-ink">{formatNaira(document.totalAmount)}</td>
                    <td><span className={badge(document.status)}>{document.status === 'sent' ? 'issued' : document.status.replaceAll('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && documents.length > 0 && (
        <p className="mt-3 text-xs text-brand-muted">Showing {visible.length} of the latest {documents.length} documents.</p>
      )}
    </div>
  );
}
