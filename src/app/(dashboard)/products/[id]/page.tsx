'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import ProductForm, { type ProductFormValues } from '@/components/ProductForm';
import type { AdminProduct } from '@/lib/types';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<ProductFormValues | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<AdminProduct>(`/products/${encodeURIComponent(params.id)}`)
      .then((product) => {
        const { id, name, size, width, length, kind, price, unitName, material, origin, thicknessMm,
          guide, imageUrl, imagePublicId, imageAlt, description, active, featured, sortOrder } = product;
        setInitial({
          id, name, size, width, length, kind, price, unitName, material, origin, thicknessMm,
          guide, imageUrl, imagePublicId, imageAlt, description, active, featured, sortOrder,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Product could not be loaded.'));
  }, [params.id]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!initial) return <p className="text-sm text-gray-400">Loading product…</p>;

  return <ProductForm initial={initial} />;
}
