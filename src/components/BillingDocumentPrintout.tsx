import type { BillingDocument } from '@/lib/types';

function formatNaira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function humanStatus(status: BillingDocument['status']): string {
  return status.replaceAll('_', ' ');
}

export default function BillingDocumentPrintout({ document }: { document: BillingDocument }) {
  const isInvoice = document.documentType === 'invoice';
  const discountLabel =
    document.discountType === 'percent'
      ? `Discount (${document.discountValue}%)`
      : 'Discount';

  return (
    <article className="billing-print-document mx-auto max-w-[210mm] border border-black/10 bg-white p-6 text-slate-900 shadow-soft sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-brand-primary pb-6">
        <div className="min-w-[220px]">
          {document.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={document.company.logoUrl} alt={`${document.company.businessName} logo`} className="mb-4 max-h-20 max-w-56 object-contain object-left" />
          ) : (
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Company logo not configured</p>
          )}
          <h2 className="font-serif text-2xl font-bold text-brand-ink">{document.company.businessName}</h2>
          <address className="mt-2 space-y-1 text-sm not-italic leading-relaxed text-slate-600">
            {document.company.addressLines.map((line) => <p key={line}>{line}</p>)}
          </address>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {document.company.phone && <p>Phone: {document.company.phone}</p>}
            {document.company.whatsapp && document.company.whatsapp !== document.company.phone && (
              <p>WhatsApp: {document.company.whatsapp}</p>
            )}
            {document.company.email && <p>Email: {document.company.email}</p>}
            {document.companyTaxId && <p>TIN / Tax ID: {document.companyTaxId}</p>}
          </div>
        </div>

        <div className="ml-auto text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
            {document.documentType}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-wide text-brand-ink">
            {document.documentNumber}
          </h1>
          <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
            {humanStatus(document.status)}
          </span>
        </div>
      </header>

      <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bill to</p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">{document.clientName}</h2>
          <address className="mt-1 space-y-1 text-sm not-italic leading-relaxed text-slate-600">
            {document.clientAddress.split(/\r?\n/).filter(Boolean).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
          </address>
          {document.clientPhone && <p className="mt-1 text-sm text-slate-600">Phone: {document.clientPhone}</p>}
          {document.clientEmail && <p className="mt-1 text-sm text-slate-600">Email: {document.clientEmail}</p>}
          {document.clientTaxId && <p className="mt-1 text-sm text-slate-600">Client TIN / Tax ID: {document.clientTaxId}</p>}
          {document.clientReference && <p className="mt-1 text-sm text-slate-600">PO / Project reference: {document.clientReference}</p>}
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3 text-sm sm:justify-self-end">
          <dt className="text-slate-500">Issue date</dt><dd className="text-right font-semibold">{formatDate(document.issueDate)}</dd>
          {isInvoice ? (
            <>
              <dt className="text-slate-500">Due date</dt><dd className="text-right font-semibold">{formatDate(document.dueDate)}</dd>
            </>
          ) : (
            <>
              <dt className="text-slate-500">Valid until</dt><dd className="text-right font-semibold">{formatDate(document.validUntil)}</dd>
            </>
          )}
        </dl>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-3 pr-3">Description</th>
              <th className="px-2 py-3 text-right">Qty</th>
              <th className="px-2 py-3">Unit</th>
              <th className="px-2 py-3 text-right">Unit price</th>
              <th className="py-3 pl-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {document.lineItems.map((item, index) => (
              <tr key={`${index}-${item.description}`} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-3 font-medium">{item.description}</td>
                <td className="px-2 py-3 text-right tabular-nums">{item.quantity.toLocaleString('en-NG')}</td>
                <td className="px-2 py-3 text-slate-600">{item.unit}</td>
                <td className="px-2 py-3 text-right tabular-nums">{formatNaira(item.unitPrice)}</td>
                <td className="py-3 pl-2 text-right font-semibold tabular-nums">{formatNaira(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-6 grid gap-8 sm:grid-cols-[1fr_290px]">
        <div className="space-y-5">
          {document.paymentInstructions && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment instructions</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{document.paymentInstructions}</p>
            </div>
          )}
          {document.notes && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{document.notes}</p>
            </div>
          )}
          {document.terms && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Terms and conditions</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{document.terms}</p>
            </div>
          )}
        </div>

        <dl className="space-y-2 border-t border-slate-200 pt-4 text-sm sm:border-t-0 sm:pt-0">
          <div className="flex justify-between gap-4"><dt className="text-slate-600">Subtotal</dt><dd className="tabular-nums">{formatNaira(document.subtotal)}</dd></div>
          {document.discountAmount > 0 && (
            <div className="flex justify-between gap-4"><dt className="text-slate-600">{discountLabel}</dt><dd className="tabular-nums">−{formatNaira(document.discountAmount)}</dd></div>
          )}
          {document.shippingAmount > 0 && (
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Delivery / shipping</dt><dd className="tabular-nums">{formatNaira(document.shippingAmount)}</dd></div>
          )}
          {document.taxAmount > 0 && (
            <div className="flex justify-between gap-4"><dt className="text-slate-600">{document.taxLabel} ({document.taxRate}%)</dt><dd className="tabular-nums">{formatNaira(document.taxAmount)}</dd></div>
          )}
          <div className="flex justify-between gap-4 border-t-2 border-slate-300 pt-3 text-base font-bold">
            <dt>{isInvoice ? 'Total due' : 'Quotation total'}</dt>
            <dd className="tabular-nums">{formatNaira(document.totalAmount)}</dd>
          </div>
          {isInvoice && document.amountPaid > 0 && (
            <>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Amount paid</dt><dd className="tabular-nums">{formatNaira(document.amountPaid)}</dd></div>
              <div className="flex justify-between gap-4 text-base font-bold text-brand-primary">
                <dt>Balance due</dt><dd className="tabular-nums">{formatNaira(document.balanceDue)}</dd>
              </div>
            </>
          )}
          {!isInvoice && (
            <p className="pt-2 text-right text-xs text-slate-500">Prices and availability are subject to the quotation terms above.</p>
          )}
        </dl>
      </section>

      {isInvoice && document.payments.length > 0 && (
        <section className="mt-8">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Payments received</h3>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="px-2 py-2">Method</th>
                <th className="px-2 py-2">Reference</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {document.payments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{formatDate(payment.paymentDate)}</td>
                  <td className="px-2 py-2">{payment.method}</td>
                  <td className="px-2 py-2">{payment.reference || '—'}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{formatNaira(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        Thank you for choosing {document.company.businessName}.
      </footer>
    </article>
  );
}
