import BillingDocumentEditor from '@/components/BillingDocumentEditor';
import type { BillingDocumentType } from '@/lib/types';

export default function NewBillingDocumentPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const documentType: BillingDocumentType = searchParams.type === 'quotation' ? 'quotation' : 'invoice';
  return <BillingDocumentEditor documentType={documentType} />;
}
