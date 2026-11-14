'use client';

import { useState } from 'react';
import { uploadToCloudinary } from '@/lib/upload';
import type { ProductGalleryImage } from '@/lib/types';

const MAX_IMAGES = 24;

interface Props {
  images: ProductGalleryImage[];
  onChange: (images: ProductGalleryImage[]) => void;
}

export default function ProductGalleryEditor({ images, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    if (files.length > remaining) {
      setError(`You can add up to ${MAX_IMAGES} images per product.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const uploaded: ProductGalleryImage[] = [];
      for (const file of files) {
        const { url, publicId } = await uploadToCloudinary(file, 'products');
        uploaded.push({
          url,
          publicId,
          alt: '',
          category: 'product',
          caption: '',
        });
        onChange([...images, ...uploaded]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'One or more images could not be uploaded.');
    } finally {
      setBusy(false);
    }
  }

  function updateImage(index: number, patch: Partial<ProductGalleryImage>) {
    onChange(images.map((image, imageIndex) => (
      imageIndex === index ? { ...image, ...patch } : image
    )));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label">Product image catalogue</p>
        <p className="mb-3 text-xs text-gray-500">
          Add product, installation, and customer photos. The first image is used as the main shop image.
        </p>
        <label className="btn btn-ghost inline-flex cursor-pointer">
          {busy ? 'Uploading…' : 'Upload images'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={uploadFiles}
            disabled={busy || images.length >= MAX_IMAGES}
          />
        </label>
        <span className="ml-3 text-xs text-gray-500">{images.length}/{MAX_IMAGES} images</span>
      </div>

      {images.map((image, index) => (
        <article key={`${image.publicId ?? image.url}-${index}`} className="rounded-xl border border-gray-200 p-3">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.alt || ''} className="h-20 w-24 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor={`gallery-category-${index}`}>Image type</label>
              <select
                id={`gallery-category-${index}`}
                className="input"
                value={image.category}
                onChange={(event) => updateImage(index, {
                  category: event.target.value as ProductGalleryImage['category'],
                })}
              >
                <option value="product">Product photo</option>
                <option value="installation">Installation photo</option>
                <option value="customer">Customer photo</option>
              </select>
            </div>
            <button
              type="button"
              className="self-start text-sm text-gray-500 hover:text-red-600"
              onClick={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}
              aria-label={`Remove image ${index + 1}`}
            >
              Remove
            </button>
          </div>
          <label className="label mt-3" htmlFor={`gallery-alt-${index}`}>Alt text</label>
          <input
            id={`gallery-alt-${index}`}
            className="input"
            maxLength={200}
            value={image.alt}
            onChange={(event) => updateImage(index, { alt: event.target.value })}
            placeholder="Describe what is visible in the photo"
          />
          <label className="label mt-3" htmlFor={`gallery-caption-${index}`}>Caption (optional)</label>
          <input
            id={`gallery-caption-${index}`}
            className="input"
            maxLength={300}
            value={image.caption}
            onChange={(event) => updateImage(index, { caption: event.target.value })}
            placeholder="Short caption shown with this photo"
          />
        </article>
      ))}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
