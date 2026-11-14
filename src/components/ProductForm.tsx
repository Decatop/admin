'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { AdminProduct } from '@/lib/types';
import ProductGalleryEditor from './ProductGalleryEditor';

export type ProductFormValues = Omit<AdminProduct, 'id' | 'updatedAt'> & { id?: string };

export const EMPTY_PRODUCT: ProductFormValues = {
  name: '',
  size: '',
  width: 1,
  length: 1,
  kind: 'sheet',
  price: null,
  unitName: 'sheet',
  material: null,
  origin: null,
  thicknessMm: null,
  guide: null,
  imageUrl: null,
  imagePublicId: null,
  imageAlt: '',
  galleryImages: [],
  installationVideos: [],
  specifications: [],
  description: '',
  active: true,
  featured: false,
  sortOrder: 0,
};

const numericInput = (value: number | null) => (value === null ? '' : String(value));

export default function ProductForm({ initial }: { initial: ProductFormValues }) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setV((previous) => ({ ...previous, [key]: value }));

  function updateGallery(galleryImages: ProductFormValues['galleryImages']) {
    const firstImage = galleryImages[0];
    setV((previous) => ({
      ...previous,
      galleryImages,
      imageUrl: firstImage?.url ?? null,
      imagePublicId: firstImage?.publicId ?? null,
      imageAlt: firstImage?.alt ?? '',
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...v,
        installationVideos: v.installationVideos.map((video) => video.trim()).filter(Boolean),
        specifications: v.specifications
          .filter((specification) => specification.name.trim() || specification.value.trim())
          .map((specification) => ({
            name: specification.name.trim(),
            value: specification.value.trim(),
          })),
      };
      if (v.id) {
        await api.put(`/products/${v.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      router.push('/products');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Product could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{v.id ? 'Edit Product' : 'New Product'}</h1>
          <p className="page-subtitle">Product details power the public shop and both calculators.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/products" className="btn btn-ghost">
            Cancel
          </Link>
          <button type="button" disabled={saving} onClick={save} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="card space-y-4">
            <h2 className="text-sm font-bold text-brand-ink">Product details</h2>
            <div>
              <label className="label" htmlFor="product-name">Product name</label>
              <input
                id="product-name"
                required
                maxLength={160}
                className="input"
                value={v.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. PVC/UV marble sheet"
              />
            </div>
            <div>
              <label className="label" htmlFor="product-description">Product description</label>
              <textarea
                id="product-description"
                className="input"
                rows={6}
                maxLength={3000}
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Describe the product, its finish, recommended uses, and care."
              />
              <p className="mt-1 text-xs text-brand-muted">{v.description.length}/3000 characters</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="product-size">Size shown to customers</label>
                <input
                  id="product-size"
                  required
                  maxLength={100}
                  className="input"
                  value={v.size}
                  onChange={(e) => set('size', e.target.value)}
                  placeholder="e.g. 4ft x 8ft"
                />
              </div>
              <div>
                <label className="label" htmlFor="product-kind">Calculator item type</label>
                <select
                  id="product-kind"
                  className="input"
                  value={v.kind}
                  onChange={(e) => set('kind', e.target.value as ProductFormValues['kind'])}
                >
                  <option value="sheet">Sheet or board</option>
                  <option value="strip">Upright strip panel</option>
                  <option value="roll">Roll</option>
                </select>
              </div>
            </div>
            <p className="-mt-2 text-xs text-brand-muted">
              Width and length below are the real dimensions in metres used by the calculator.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="product-width">Width (m)</label>
                <input
                  id="product-width"
                  required
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  className="input"
                  value={v.width}
                  onChange={(e) => set('width', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label" htmlFor="product-length">
                  {v.kind === 'roll' ? 'Roll length (m)' : 'Length (m)'}
                </label>
                <input
                  id="product-length"
                  required
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  className="input"
                  value={v.length}
                  onChange={(e) => set('length', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="product-price">Price in naira</label>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="1"
                  className="input"
                  value={numericInput(v.price)}
                  onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="Leave blank for price on request"
                />
              </div>
              <div>
                <label className="label" htmlFor="product-unit">Price unit</label>
                <input
                  id="product-unit"
                  required
                  maxLength={40}
                  className="input"
                  value={v.unitName}
                  onChange={(e) => set('unitName', e.target.value)}
                  placeholder="sheet, board, panel, roll"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="product-thickness">Thickness (mm)</label>
                <input
                  id="product-thickness"
                  type="number"
                  min="0"
                  step="0.1"
                  className="input"
                  value={numericInput(v.thicknessMm)}
                  onChange={(e) => set('thicknessMm', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="label" htmlFor="product-material">Material</label>
                <input
                  id="product-material"
                  maxLength={100}
                  className="input"
                  value={v.material ?? ''}
                  onChange={(e) => set('material', e.target.value || null)}
                  placeholder="e.g. PVC, WPC"
                />
              </div>
              <div>
                <label className="label" htmlFor="product-origin">Origin</label>
                <input
                  id="product-origin"
                  maxLength={100}
                  className="input"
                  value={v.origin ?? ''}
                  onChange={(e) => set('origin', e.target.value || null)}
                  placeholder="e.g. Local, Imported"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="product-guide">Related guide URL (optional)</label>
              <input
                id="product-guide"
                type="url"
                className="input"
                value={v.guide ?? ''}
                onChange={(e) => set('guide', e.target.value || null)}
                placeholder="/articles/price-guide"
              />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-brand-ink">Detailed specifications</h3>
                  <p className="mt-1 text-xs text-brand-muted">Add useful product attributes such as finish, use, or care.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={v.specifications.length >= 30}
                  onClick={() => set('specifications', [...v.specifications, { name: '', value: '' }])}
                >
                  Add specification
                </button>
              </div>
              <div className="space-y-3">
                {v.specifications.map((specification, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                    <input
                      className="input"
                      maxLength={80}
                      aria-label={`Specification ${index + 1} name`}
                      value={specification.name}
                      onChange={(event) => set('specifications', v.specifications.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, name: event.target.value } : item
                      )))}
                      placeholder="Name, e.g. Finish"
                    />
                    <input
                      className="input"
                      maxLength={300}
                      aria-label={`Specification ${index + 1} value`}
                      value={specification.value}
                      onChange={(event) => set('specifications', v.specifications.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, value: event.target.value } : item
                      )))}
                      placeholder="Value, e.g. Gloss"
                    />
                    <button
                      type="button"
                      className="text-sm text-gray-500 hover:text-red-600"
                      onClick={() => set('specifications', v.specifications.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-brand-ink">Installation videos</h3>
                  <p className="mt-1 text-xs text-brand-muted">Use secure YouTube or Vimeo video links.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={v.installationVideos.length >= 12}
                  onClick={() => set('installationVideos', [...v.installationVideos, ''])}
                >
                  Add video
                </button>
              </div>
              <div className="space-y-3">
                {v.installationVideos.map((video, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="url"
                      className="input"
                      aria-label={`Installation video URL ${index + 1}`}
                      value={video}
                      onChange={(event) => set('installationVideos', v.installationVideos.map((item, itemIndex) => (
                        itemIndex === index ? event.target.value : item
                      )))}
                      placeholder="https://youtu.be/..."
                    />
                    <button
                      type="button"
                      className="text-sm text-gray-500 hover:text-red-600"
                      onClick={() => set('installationVideos', v.installationVideos.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card">
            <ProductGalleryEditor images={v.galleryImages} onChange={updateGallery} />
          </section>
          <section className="card space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-ink">
              <input type="checkbox" checked={v.active} onChange={(e) => set('active', e.target.checked)} />
              Show in public shop and calculators
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-ink">
              <input type="checkbox" checked={v.featured} onChange={(e) => set('featured', e.target.checked)} />
              Feature this product
            </label>
            <div>
              <label className="label" htmlFor="product-order">Display order</label>
              <input
                id="product-order"
                type="number"
                min="0"
                step="1"
                className="input"
                value={v.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value))}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
