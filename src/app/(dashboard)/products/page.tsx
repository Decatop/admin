'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminProduct } from '@/lib/types';

type VisibilityFilter = 'all' | 'active' | 'hidden';

const price = (value: number | null, unit: string) =>
  value === null ? 'Price on request' : `₦${Math.round(value).toLocaleString('en-NG')} / ${unit}`;

export default function ProductsPage() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (visibility === 'all' || (visibility === 'active' ? item.active : !item.active)) &&
        (!query || `${item.name} ${item.size} ${item.material ?? ''}`.toLowerCase().includes(query)),
    );
  }, [items, search, visibility]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await api.get<AdminProduct[]>('/products'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Products could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(product: AdminProduct) {
    if (!confirm(`Delete "${product.name} (${product.size})"? This cannot be undone.`)) return;
    setError('');
    try {
      await api.del(`/products/${product.id}`);
      setItems((previous) => previous.filter((item) => item.id !== product.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Product could not be deleted.');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage the shop catalog, price units, specifications and images.</p>
        </div>
        <Link href="/products/new" className="btn-primary">
          <Plus size={18} /> New Product
        </Link>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            aria-label="Search products"
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or sizes…"
          />
        </div>
        <div className="flex gap-1 border border-black/10 bg-white p-1" aria-label="Filter products by visibility">
          {(['all', 'active', 'hidden'] as VisibilityFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={visibility === filter}
              onClick={() => setVisibility(filter)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                visibility === filter ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-ink'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="text-xs text-brand-muted">{visible.length} of {items.length}</span>
      </div>

      <div className="overflow-hidden border border-black/5 bg-white shadow-soft">
        {loading ? (
          <p className="p-6 text-sm text-brand-muted">Loading products…</p>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={28} className="mx-auto text-brand-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-brand-ink">No products yet</p>
            <p className="mt-1 text-sm text-brand-muted">Create a product to add it to the shop; calculator use is optional.</p>
            <Link href="/products/new" className="btn-primary mt-5 inline-flex">
              <Plus size={18} /> New Product
            </Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Visibility</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-brand-muted">
                    No products match these filters.
                  </td>
                </tr>
              )}
              {visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" className="h-12 w-14 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-14 items-center justify-center rounded bg-brand-bg text-brand-primary">
                          <Package size={18} aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-brand-ink">
                          {product.name}
                          {product.featured && <span className="badge badge-gold ml-2">Featured</span>}
                        </p>
                        <p className="text-xs text-brand-muted">{product.size}{product.thicknessMm ? ` · ${product.thicknessMm}mm` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-brand-muted">{price(product.price, product.unitName)}</td>
                  <td>
                    <span className={`badge ${product.active ? 'badge-green' : 'badge-gray'}`}>
                      {product.active ? 'In shop' : 'Hidden'}
                    </span>
                  </td>
                  <td className="text-brand-muted">{new Date(product.updatedAt).toLocaleDateString()}</td>
                  <td className="text-right">
                    <Link
                      href={`/products/${encodeURIComponent(product.id)}`}
                      className="inline-flex items-center gap-1 font-semibold text-brand-primary hover:underline"
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(product)}
                      className="ml-4 inline-flex items-center gap-1 font-semibold text-brand-muted hover:text-red-600"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
