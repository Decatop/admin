import BillingDocumentEditor from '@/components/BillingDocumentEditor';

export default function EditBillingDocumentPage({ params }: { params: { id: string } }) {
  return <BillingDocumentEditor id={params.id} />;
}
