'use client';

import ProductForm, { EMPTY_PRODUCT } from '@/components/ProductForm';

export default function NewProductPage() {
  return <ProductForm initial={EMPTY_PRODUCT} />;
}
