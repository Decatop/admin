import BillingDocumentView from '@/components/BillingDocumentView';

export default function BillingDocumentPage({ params }: { params: { id: string } }) {
  return <BillingDocumentView id={params.id} />;
}
