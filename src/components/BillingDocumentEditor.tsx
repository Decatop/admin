'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  AdminProduct,
  BillingCustomer,
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
    customerId: null,
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
    lineItems: [{ productId: null, description: '', quantity: 1, unit: 'piece', unitPrice: 0 }],
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
    customerId: document.customerId,
    clientName: document.clientName,
    clientEmail: document.clientEmail,
    clientPhone: document.clientPhone,
    clientTaxId: document.clientTaxId,
    clientReference: document.clientReference,
    clientAddress: document.clientAddress,
    issueDate: document.issueDate,
    dueDate: document.dueDate,
    validUntil: document.validUntil,
    lineItems: document.lineItems.map(({ productId, description, quantity, unit, unitPrice }) => ({
      productId,
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

interface StoredBillingDraft {
  version: 1;
  status: 'editing' | 'saved';
  updatedAt: string;
  editor: BillingEditorSnapshot;
}

interface BillingEditorSnapshot {
  form: BillingDocumentInput;
  customerDraft: CustomerDraft;
  showCustomerForm: boolean;
  quickProduct: QuickProductDraft;
  addingProductForLine: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBillingDocumentInput(value: unknown): value is BillingDocumentInput {
  if (!isRecord(value)) return false;
  const nullableText = (field: unknown) => field === null || typeof field === 'string';
  const lineItems = value.lineItems;

  return (
    (value.documentType === 'invoice' || value.documentType === 'quotation') &&
    nullableText(value.customerId) &&
    typeof value.clientName === 'string' &&
    nullableText(value.clientEmail) &&
    nullableText(value.clientPhone) &&
    typeof value.clientTaxId === 'string' &&
    typeof value.clientReference === 'string' &&
    typeof value.clientAddress === 'string' &&
    typeof value.issueDate === 'string' &&
    nullableText(value.dueDate) &&
    nullableText(value.validUntil) &&
    Array.isArray(lineItems) &&
    lineItems.every((item) =>
      isRecord(item) &&
      (item.productId === undefined || nullableText(item.productId)) &&
      typeof item.description === 'string' &&
      typeof item.quantity === 'number' &&
      Number.isFinite(item.quantity) &&
      typeof item.unit === 'string' &&
      typeof item.unitPrice === 'number' &&
      Number.isFinite(item.unitPrice),
    ) &&
    (value.discountType === 'fixed' || value.discountType === 'percent') &&
    typeof value.discountValue === 'number' &&
    Number.isFinite(value.discountValue) &&
    typeof value.shippingAmount === 'number' &&
    Number.isFinite(value.shippingAmount) &&
    typeof value.taxLabel === 'string' &&
    typeof value.taxRate === 'number' &&
    Number.isFinite(value.taxRate) &&
    typeof value.paymentInstructions === 'string' &&
    typeof value.notes === 'string' &&
    typeof value.terms === 'string'
  );
}

function isBillingEditorSnapshot(value: unknown): value is BillingEditorSnapshot {
  if (
    !isRecord(value) ||
    !isBillingDocumentInput(value.form) ||
    !isRecord(value.customerDraft) ||
    !isRecord(value.quickProduct)
  ) {
    return false;
  }

  const customerDraft = value.customerDraft;
  const quickProduct = value.quickProduct;
  return (
    ['name', 'email', 'phone', 'taxId', 'address'].every(
      (field) => typeof customerDraft[field] === 'string',
    ) &&
    typeof value.showCustomerForm === 'boolean' &&
    ['name', 'size', 'width', 'length', 'price', 'unitName', 'material', 'origin', 'thicknessMm'].every(
      (field) => typeof quickProduct[field] === 'string',
    ) &&
    (quickProduct.kind === 'sheet' || quickProduct.kind === 'strip' || quickProduct.kind === 'roll') &&
    (value.addingProductForLine === null ||
      (typeof value.addingProductForLine === 'number' &&
        Number.isInteger(value.addingProductForLine) &&
        value.addingProductForLine >= 0))
  );
}

function isStoredBillingDraft(value: unknown): value is StoredBillingDraft {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.status === 'editing' || value.status === 'saved') &&
    typeof value.updatedAt === 'string' &&
    isBillingEditorSnapshot(value.editor)
  );
}

function readBrowserDraft(key: string, documentType?: BillingDocumentType): StoredBillingDraft | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  const value: unknown = JSON.parse(raw);
  if (
    !isStoredBillingDraft(value) ||
    (documentType && value.editor.form.documentType !== documentType)
  ) {
    throw new Error('The saved browser draft is invalid and could not be restored.');
  }
  return value;
}

function writeBrowserDraft(
  key: string,
  editor: BillingEditorSnapshot,
  status: StoredBillingDraft['status'],
): string {
  const updatedAt = new Date().toISOString();
  const draft: StoredBillingDraft = { version: 1, status, updatedAt, editor };
  window.localStorage.setItem(key, JSON.stringify(draft));
  return updatedAt;
}

function productDescription(product: AdminProduct): string {
  const details = [
    product.size,
    product.material,
    product.origin,
    product.thicknessMm ? `${product.thicknessMm} mm` : null,
  ].filter(Boolean);
  return `${product.name}${details.length ? ` (${details.join(', ')})` : ''}`.slice(0, 240);
}

function productOptionLabel(product: AdminProduct): string {
  const specifications = [
    product.size,
    product.thicknessMm ? `${product.thicknessMm} mm` : null,
    product.material,
    product.origin,
  ].filter(Boolean);
  const price = product.price === null
    ? 'Price not set'
    : `${money(product.price)} / ${product.unitName}`;
  return `${product.name}${specifications.length ? ` — ${specifications.join(' · ')}` : ''} — ${price}`;
}

function money(value: number): string {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CustomerDraft {
  name: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
}

interface QuickProductDraft {
  name: string;
  size: string;
  width: string;
  length: string;
  kind: AdminProduct['kind'];
  price: string;
  unitName: string;
  material: string;
  origin: string;
  thicknessMm: string;
}

const emptyCustomerDraft: CustomerDraft = {
  name: '',
  email: '',
  phone: '',
  taxId: '',
  address: '',
};

const emptyQuickProductDraft: QuickProductDraft = {
  name: '',
  size: '',
  width: '',
  length: '',
  kind: 'sheet',
  price: '',
  unitName: 'piece',
  material: '',
  origin: '',
  thicknessMm: '',
};

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
    shipping: Math.round(document.shippingAmount * 100) / 100,
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
  const [browserDraftError, setBrowserDraftError] = useState('');
  const [browserDraftUpdatedAt, setBrowserDraftUpdatedAt] = useState<string | null>(null);
  const [browserDraftRestored, setBrowserDraftRestored] = useState(false);
  const [browserDraftReady, setBrowserDraftReady] = useState(false);
  const [companyWarning, setCompanyWarning] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(emptyCustomerDraft);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerCreateError, setCustomerCreateError] = useState('');
  const [addingProductForLine, setAddingProductForLine] = useState<number | null>(null);
  const [quickProduct, setQuickProduct] = useState<QuickProductDraft>(emptyQuickProductDraft);
  const [productSaving, setProductSaving] = useState(false);
  const [productCreateError, setProductCreateError] = useState('');
  const totals = useMemo(() => (form ? previewTotals(form) : null), [form]);
  const browserDraftKey = `nasuru-admin-billing-draft:v1:${id
    ? `document:${encodeURIComponent(id)}`
    : `new:${documentType}`}`;

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      const [productResult, customerResult] = await Promise.allSettled([
        api.get<AdminProduct[]>('/products'),
        api.get<BillingCustomer[]>('/billing-customers'),
      ]);
      if (!active) return;

      if (productResult.status === 'fulfilled') {
        setProducts((previous) => {
          const byId = new Map(productResult.value.map((product) => [product.id, product]));
          previous.forEach((product) => byId.set(product.id, product));
          return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
        });
      } else {
        setProductsError(
          productResult.reason instanceof Error
            ? productResult.reason.message
            : 'Products could not be loaded.',
        );
      }
      if (customerResult.status === 'fulfilled') {
        setCustomers((previous) => {
          const byId = new Map(customerResult.value.map((customer) => [customer.id, customer]));
          previous.forEach((customer) => byId.set(customer.id, customer));
          return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
        });
      } else {
        setCustomersError(
          customerResult.reason instanceof Error
            ? customerResult.reason.message
            : 'Customers could not be loaded.',
        );
      }
      setProductsLoading(false);
      setCustomersLoading(false);
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setForm(null);
      setBrowserDraftReady(false);
      setBrowserDraftError('');
      setBrowserDraftUpdatedAt(null);
      setBrowserDraftRestored(false);
      setCompanyWarning(false);
      setShowCustomerForm(false);
      setCustomerDraft(emptyCustomerDraft);
      setQuickProduct(emptyQuickProductDraft);
      setAddingProductForLine(null);
      setError('');

      let browserDraft: StoredBillingDraft | null = null;
      try {
        browserDraft = readBrowserDraft(browserDraftKey, id ? undefined : documentType);
      } catch (draftError) {
        if (active) {
          setBrowserDraftError(
            draftError instanceof Error
              ? draftError.message
              : 'The saved browser draft could not be restored.',
          );
        }
      }

      try {
        if (id) {
          try {
            const document = await api.get<BillingDocument>(`/billing-documents/${encodeURIComponent(id)}`);
            if (document.status !== 'draft') {
              router.replace(`/invoices/${encodeURIComponent(id)}`);
              return;
            }
            if (active) {
              if (browserDraft && browserDraft.editor.form.documentType !== document.documentType) {
                setBrowserDraftError('The saved browser draft does not match this document and was ignored.');
                browserDraft = null;
              }
              const restoredDraft = browserDraft?.status === 'editing' ? browserDraft.editor : null;
              setForm(restoredDraft?.form ?? toInput(document));
              if (restoredDraft) {
                setCustomerDraft(restoredDraft.customerDraft);
                setShowCustomerForm(restoredDraft.showCustomerForm);
                setQuickProduct(restoredDraft.quickProduct);
                setAddingProductForLine(
                  restoredDraft.addingProductForLine !== null &&
                    restoredDraft.addingProductForLine < restoredDraft.form.lineItems.length
                    ? restoredDraft.addingProductForLine
                    : null,
                );
              }
              setBrowserDraftRestored(browserDraft?.status === 'editing');
              setBrowserDraftUpdatedAt(browserDraft?.status === 'editing' ? browserDraft.updatedAt : null);
              setBrowserDraftReady(true);
              setCompanyWarning(
                !document.company.logoUrl ||
                (!document.company.phone && !document.company.whatsapp) ||
                document.company.addressLines.length === 0,
              );
            }
          } catch (loadError) {
            if (active && browserDraft) {
              setForm(browserDraft.editor.form);
              setCustomerDraft(browserDraft.editor.customerDraft);
              setShowCustomerForm(browserDraft.editor.showCustomerForm);
              setQuickProduct(browserDraft.editor.quickProduct);
              setAddingProductForLine(
                browserDraft.editor.addingProductForLine !== null &&
                  browserDraft.editor.addingProductForLine < browserDraft.editor.form.lineItems.length
                  ? browserDraft.editor.addingProductForLine
                  : null,
              );
              setBrowserDraftRestored(browserDraft.status === 'editing');
              setBrowserDraftUpdatedAt(browserDraft.updatedAt);
              setBrowserDraftReady(true);
              setError('The saved document could not be reached. Your browser-saved edits were restored; reconnect before saving them to the server.');
            } else {
              throw loadError;
            }
          }
        } else {
          if (browserDraft?.status === 'editing') {
            if (active) {
              setForm(browserDraft.editor.form);
              setCustomerDraft(browserDraft.editor.customerDraft);
              setShowCustomerForm(browserDraft.editor.showCustomerForm);
              setQuickProduct(browserDraft.editor.quickProduct);
              setAddingProductForLine(
                browserDraft.editor.addingProductForLine !== null &&
                  browserDraft.editor.addingProductForLine < browserDraft.editor.form.lineItems.length
                  ? browserDraft.editor.addingProductForLine
                  : null,
              );
              setBrowserDraftRestored(true);
              setBrowserDraftUpdatedAt(browserDraft.updatedAt);
              setBrowserDraftReady(true);
            }
            return;
          }
          const [settings, company] = await Promise.all([
            api.get<BillingSettings>('/billing-settings'),
            api.get<SiteSettings>('/site-settings'),
          ]);
          if (active) {
            setForm(newDraft(documentType, settings));
            setBrowserDraftReady(true);
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
  }, [id, documentType, router, browserDraftKey]);

  useEffect(() => {
    if (!browserDraftReady || !form) return;
    try {
      setBrowserDraftUpdatedAt(writeBrowserDraft(browserDraftKey, {
        form,
        customerDraft,
        showCustomerForm,
        quickProduct,
        addingProductForLine,
      }, 'editing'));
      setBrowserDraftError('');
    } catch (draftError) {
      setBrowserDraftError(
        draftError instanceof Error
          ? `This browser could not save your automatic recovery draft: ${draftError.message}`
          : 'This browser could not save your automatic recovery draft. Use Save draft to store it on the server.',
      );
    }
  }, [
    addingProductForLine,
    browserDraftKey,
    browserDraftReady,
    customerDraft,
    form,
    quickProduct,
    showCustomerForm,
  ]);

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

  function selectCustomer(customerId: string) {
    const customer = customers.find((entry) => entry.id === customerId);
    setForm((previous) =>
      previous
        ? {
            ...previous,
            customerId: customer?.id ?? null,
            ...(customer
              ? {
                  clientName: customer.name,
                  clientEmail: customer.email,
                  clientPhone: customer.phone,
                  clientTaxId: customer.taxId,
                  clientAddress: customer.address,
                }
              : {}),
          }
        : previous,
    );
  }

  async function saveCustomer() {
    setCustomerCreateError('');
    if (!customerDraft.name.trim()) {
      setCustomerCreateError('Enter a customer or business name.');
      return;
    }
    setCustomerSaving(true);
    try {
      const customer = await api.post<BillingCustomer>('/billing-customers', {
        name: customerDraft.name,
        email: customerDraft.email || null,
        phone: customerDraft.phone || null,
        taxId: customerDraft.taxId,
        address: customerDraft.address,
      });
      setCustomers((previous) =>
        [customer, ...previous.filter((entry) => entry.id !== customer.id)].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setCustomersError('');
      setForm((previous) =>
        previous
          ? {
              ...previous,
              customerId: customer.id,
              clientName: customer.name,
              clientEmail: customer.email,
              clientPhone: customer.phone,
              clientTaxId: customer.taxId,
              clientAddress: customer.address,
            }
          : previous,
      );
      setCustomerDraft(emptyCustomerDraft);
      setShowCustomerForm(false);
    } catch (e) {
      setCustomerCreateError(e instanceof Error ? e.message : 'Customer could not be saved.');
    } finally {
      setCustomerSaving(false);
    }
  }

  function applyProductToLine(index: number, product: AdminProduct) {
    updateLine(index, {
      productId: product.id,
      description: productDescription(product),
      unit: product.unitName,
      unitPrice: product.price ?? 0,
    });
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((entry) => entry.id === productId);
    if (product) applyProductToLine(index, product);
    else updateLine(index, { productId: null });
  }

  async function saveQuickProduct() {
    const lineIndex = addingProductForLine;
    if (lineIndex === null) return;
    setProductCreateError('');
    const width = Number(quickProduct.width);
    const length = Number(quickProduct.length);
    const price = quickProduct.price.trim() ? Number(quickProduct.price) : null;
    const thicknessMm = quickProduct.thicknessMm.trim() ? Number(quickProduct.thicknessMm) : null;
    if (
      !quickProduct.name.trim() ||
      !quickProduct.size.trim() ||
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(length) ||
      length <= 0 ||
      !quickProduct.unitName.trim() ||
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      (thicknessMm !== null && (!Number.isFinite(thicknessMm) || thicknessMm <= 0))
    ) {
      setProductCreateError('Enter a name, size, positive dimensions, and valid price or thickness values.');
      return;
    }

    setProductSaving(true);
    try {
      const product = await api.post<AdminProduct>('/products', {
        name: quickProduct.name,
        size: quickProduct.size,
        width,
        length,
        kind: quickProduct.kind,
        price,
        unitName: quickProduct.unitName,
        material: quickProduct.material || null,
        origin: quickProduct.origin || null,
        thicknessMm,
        guide: null,
        imageUrl: null,
        imagePublicId: null,
        imageAlt: '',
        description: '',
        active: true,
        featured: false,
        sortOrder: products.length,
      });
      setProducts((previous) => [...previous, product].sort((a, b) => a.sortOrder - b.sortOrder));
      setProductsError('');
      applyProductToLine(lineIndex, product);
      setQuickProduct(emptyQuickProductDraft);
      setAddingProductForLine(null);
    } catch (e) {
      setProductCreateError(e instanceof Error ? e.message : 'Product could not be saved.');
    } finally {
      setProductSaving(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const saved = id
        ? await api.put<BillingDocument>(`/billing-documents/${encodeURIComponent(id)}`, form)
        : await api.post<BillingDocument>('/billing-documents', form);
      try {
        window.localStorage.removeItem(browserDraftKey);
        setBrowserDraftReady(false);
        setBrowserDraftRestored(false);
        setBrowserDraftError('');
      } catch {
        try {
          writeBrowserDraft(browserDraftKey, {
            form: toInput(saved),
            customerDraft: emptyCustomerDraft,
            showCustomerForm: false,
            quickProduct: emptyQuickProductDraft,
            addingProductForLine: null,
          }, 'saved');
          setBrowserDraftReady(false);
          setBrowserDraftRestored(false);
          setBrowserDraftError('');
        } catch (draftError) {
          setBrowserDraftError(
            draftError instanceof Error
              ? `The server saved this draft, but the browser recovery copy could not be cleared or updated: ${draftError.message}`
              : 'The server saved this draft, but the browser recovery copy could not be cleared or updated.',
          );
        }
      }
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
      {browserDraftError ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{browserDraftError}</p>
      ) : (
        <p role="status" className="text-xs text-brand-muted">
          {browserDraftUpdatedAt
            ? `Automatically saved in this browser at ${new Date(browserDraftUpdatedAt).toLocaleTimeString()}${browserDraftRestored ? ' · unsaved changes restored' : ''}.`
            : 'Changes are automatically saved in this browser. Save draft stores them on the server.'}
        </p>
      )}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="saved-customer" className="label">Choose a saved customer</label>
            <select id="saved-customer" className="input" value={form.customerId ?? ''}
              onChange={(event) => selectCustomer(event.target.value)}>
              <option value="">Enter customer details manually</option>
              {form.customerId && !customers.some((customer) => customer.id === form.customerId) && (
                <option value={form.customerId}>Previously selected customer</option>
              )}
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.email ? ` · ${customer.email}` : ''}{customer.phone ? ` · ${customer.phone}` : ''}
                </option>
              ))}
            </select>
            {customersLoading && <p className="mt-1 text-xs text-brand-muted">Loading saved customers…</p>}
            {customersError && (
              <p role="alert" className="mt-1 text-xs text-red-700">
                Saved customers could not be loaded. You can still enter customer details manually. {customersError}
              </p>
            )}
          </div>
          <button type="button" className="btn-ghost" onClick={() => {
            setCustomerCreateError('');
            setShowCustomerForm((open) => !open);
          }}>
            <Plus size={16} /> Add customer
          </button>
        </div>

        {showCustomerForm && (
          <div className="space-y-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4" aria-label="Add customer">
            <div>
              <h3 className="text-sm font-bold text-brand-ink">Add a saved customer</h3>
              <p className="mt-1 text-xs text-brand-muted">Save their details once, then select them on future invoices and quotations.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-customer-name" className="label">Customer / business name *</label>
                <input id="new-customer-name" className="input" maxLength={200} required
                  value={customerDraft.name}
                  onChange={(event) => setCustomerDraft((previous) => ({ ...previous, name: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="new-customer-email" className="label">Email</label>
                <input id="new-customer-email" type="email" className="input" maxLength={200}
                  value={customerDraft.email}
                  onChange={(event) => setCustomerDraft((previous) => ({ ...previous, email: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="new-customer-phone" className="label">Phone</label>
                <input id="new-customer-phone" className="input" maxLength={60}
                  value={customerDraft.phone}
                  onChange={(event) => setCustomerDraft((previous) => ({ ...previous, phone: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="new-customer-tax-id" className="label">TIN / tax ID</label>
                <input id="new-customer-tax-id" className="input" maxLength={100}
                  value={customerDraft.taxId}
                  onChange={(event) => setCustomerDraft((previous) => ({ ...previous, taxId: event.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="new-customer-address" className="label">Billing / delivery address</label>
                <textarea id="new-customer-address" className="input" rows={2} maxLength={1000}
                  value={customerDraft.address}
                  onChange={(event) => setCustomerDraft((previous) => ({ ...previous, address: event.target.value }))} />
              </div>
            </div>
            {customerCreateError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{customerCreateError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" disabled={customerSaving} onClick={() => setShowCustomerForm(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={customerSaving} onClick={() => void saveCustomer()}>
                {customerSaving ? 'Saving…' : 'Save and select customer'}
              </button>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold text-brand-ink">Client details</h2>
          <p className="mt-1 text-xs text-brand-muted">Selected customer details are copied onto this document. Changes here do not edit the saved customer record.</p>
        </div>
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
            <p className="mt-1 text-xs text-brand-muted">Choose a catalog product to fill its description, unit and price automatically, or enter a custom service.</p>
          </div>
        </div>

        <div className="space-y-3">
          {form.lineItems.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-black/5 p-3 sm:grid-cols-[minmax(180px,1fr)_100px_110px_140px_auto] sm:items-end">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor={`line-product-${index}`} className="label">Catalog product</label>
                  <button type="button" className="text-xs font-semibold text-brand-primary hover:underline"
                    onClick={() => {
                      setQuickProduct(emptyQuickProductDraft);
                      setProductCreateError('');
                      setAddingProductForLine(index);
                    }}>
                    Add product
                  </button>
                </div>
                <select id={`line-product-${index}`} className="input"
                  value={item.productId ?? ''}
                  onChange={(event) => selectProduct(index, event.target.value)}>
                  <option value="">Custom item / service</option>
                  {item.productId && !products.some((product) => product.id === item.productId) && (
                    <option value={item.productId}>Saved catalog item</option>
                  )}
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {productOptionLabel(product)}{product.active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </select>
                {productsLoading && <p className="mt-1 text-xs text-brand-muted">Loading catalog…</p>}
                {productsError && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    Catalog could not be loaded; custom lines are still available. {productsError}
                  </p>
                )}
                {!productsLoading && !productsError && products.length === 0 && (
                  <p className="mt-1 text-xs text-brand-muted">No catalog products yet. Use Add product to create one.</p>
                )}
                {item.productId && products.find((product) => product.id === item.productId)?.price === null && (
                  <p className="mt-1 text-xs text-amber-800">This product has no catalog price; enter the agreed unit price below.</p>
                )}
                <label htmlFor={`line-description-${index}`} className="label mt-3 block">Description *</label>
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
              <button type="button" disabled={form.lineItems.length <= 1 || productSaving} aria-label={`Remove line ${index + 1}`}
                onClick={() => setField('lineItems', form.lineItems.filter((_, itemIndex) => itemIndex !== index))}
                className="btn-danger h-10 px-3">
                <Trash2 size={16} />
              </button>
              <p className="text-right text-xs font-semibold text-brand-muted sm:col-span-5">
                Line total: {money(item.quantity * item.unitPrice)}
              </p>
              {addingProductForLine === index && (
                <div className="space-y-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 sm:col-span-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-brand-ink">Add product to catalog</h3>
                      <p className="mt-1 text-xs text-brand-muted">Dimensions are in metres. The new product will be selected on this line.</p>
                    </div>
                    <button type="button" className="btn-ghost px-3" disabled={productSaving}
                      onClick={() => setAddingProductForLine(null)}>Cancel</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label htmlFor={`quick-product-name-${index}`} className="label">Product name *</label>
                      <input id={`quick-product-name-${index}`} className="input" maxLength={160} required
                        value={quickProduct.name}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, name: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-size-${index}`} className="label">Display size *</label>
                      <input id={`quick-product-size-${index}`} className="input" maxLength={100} required
                        value={quickProduct.size}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, size: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-kind-${index}`} className="label">Product type *</label>
                      <select id={`quick-product-kind-${index}`} className="input" value={quickProduct.kind}
                        onChange={(event) => setQuickProduct((previous) => ({
                          ...previous,
                          kind: event.target.value as AdminProduct['kind'],
                        }))}>
                        <option value="sheet">Sheet</option>
                        <option value="strip">Strip / panel</option>
                        <option value="roll">Roll</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`quick-product-width-${index}`} className="label">Width (m) *</label>
                      <input id={`quick-product-width-${index}`} type="number" min="0.001" max="1000" step="0.001"
                        className="input" required value={quickProduct.width}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, width: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-length-${index}`} className="label">Length (m) *</label>
                      <input id={`quick-product-length-${index}`} type="number" min="0.001" max="1000" step="0.001"
                        className="input" required value={quickProduct.length}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, length: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-price-${index}`} className="label">Catalog price (₦)</label>
                      <input id={`quick-product-price-${index}`} type="number" min="0" step="0.01" className="input"
                        value={quickProduct.price}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, price: event.target.value }))}
                        placeholder="Optional" />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-unit-${index}`} className="label">Price unit *</label>
                      <input id={`quick-product-unit-${index}`} className="input" maxLength={40} required
                        value={quickProduct.unitName}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, unitName: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-material-${index}`} className="label">Material</label>
                      <input id={`quick-product-material-${index}`} className="input" maxLength={100}
                        value={quickProduct.material}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, material: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-origin-${index}`} className="label">Origin</label>
                      <input id={`quick-product-origin-${index}`} className="input" maxLength={100}
                        value={quickProduct.origin}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, origin: event.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor={`quick-product-thickness-${index}`} className="label">Thickness (mm)</label>
                      <input id={`quick-product-thickness-${index}`} type="number" min="0.001" max="1000" step="0.01"
                        className="input" value={quickProduct.thicknessMm}
                        onChange={(event) => setQuickProduct((previous) => ({ ...previous, thicknessMm: event.target.value }))} />
                    </div>
                  </div>
                  {productCreateError && (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{productCreateError}</p>
                  )}
                  <div className="flex justify-end">
                    <button type="button" className="btn-primary" disabled={productSaving}
                      onClick={() => void saveQuickProduct()}>
                      {productSaving ? 'Saving product…' : 'Save product and add to line'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-ghost" disabled={productSaving} onClick={() =>
            setField('lineItems', [...form.lineItems, { productId: null, description: '', quantity: 1, unit: 'piece', unitPrice: 0 }])
          }>
            <Plus size={16} /> Add line
          </button>
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
              <div className="flex justify-between gap-3"><dt>Delivery / shipping</dt><dd>{money(totals.shipping)}</dd></div>
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
