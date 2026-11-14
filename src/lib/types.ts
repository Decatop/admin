export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  featured: boolean;
  published_at: string | null;
  updated_at: string;
  cover_image_url: string | null;
}

export interface ArticleFull extends ArticleListItem {
  excerpt: string;
  content_html: string;
  cover_public_id: string | null;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  author: string;
  article_categories?: { category_id: string }[];
}

export interface AdminProduct {
  id: string;
  name: string;
  size: string;
  width: number;
  length: number;
  kind: 'sheet' | 'strip' | 'roll';
  price: number | null;
  unitName: string;
  material: string | null;
  origin: string | null;
  thicknessMm: number | null;
  guide: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  imageAlt: string;
  description: string;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  updatedAt: string;
}

export type BillingDocumentType = 'invoice' | 'quotation';
export type BillingDocumentStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'converted';
export type BillingDiscountType = 'fixed' | 'percent';

export interface BillingLineItemInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface BillingLineItem extends BillingLineItemInput {
  lineTotal: number;
}

export interface BillingDocumentInput {
  documentType: BillingDocumentType;
  customerId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientTaxId: string;
  clientReference: string;
  clientAddress: string;
  issueDate: string;
  dueDate: string | null;
  validUntil: string | null;
  lineItems: BillingLineItemInput[];
  discountType: BillingDiscountType;
  discountValue: number;
  shippingAmount: number;
  taxLabel: string;
  taxRate: number;
  paymentInstructions: string;
  notes: string;
  terms: string;
}

export interface BillingCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingCompanySnapshot {
  businessName: string;
  logoUrl: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  addressLines: string[];
}

export interface BillingPayment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  note: string;
  createdAt: string;
}

export interface BillingDocument extends Omit<BillingDocumentInput, 'lineItems'> {
  id: string;
  documentNumber: string;
  convertedTo: string | null;
  status: BillingDocumentStatus;
  currency: 'NGN';
  lineItems: BillingLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  company: BillingCompanySnapshot;
  companyTaxId: string;
  payments: BillingPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface BillingSettings {
  taxIdentifier: string;
  defaultTaxRate: number;
  defaultDueDays: number;
  defaultQuoteValidityDays: number;
  paymentInstructions: string;
  defaultTerms: string;
}

export interface Hero {
  heading: string;
  subheading: string;
  cta_label: string;
  cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  background_type: 'image' | 'color';
  background_color: string;
  text_color: string;
  overlay_opacity: number;
  image_url: string | null;
  image_public_id: string | null;
}

export interface SiteSettings {
  business_name: string;
  tagline: string;
  logo_url: string | null;
  logo_public_id: string | null;
  primary_color: string;
  secondary_color: string;
  default_hero_color: string;
  phone: string;
  whatsapp: string;
  whatsapp_greeting: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
  facebook_url: string;
  instagram_url: string;
  youtube_url: string;
  tiktok_url: string;
  default_meta_title: string;
  default_meta_description: string;
  copyright_text?: string;
}

export interface CarouselItem {
  id: string;
  image_url: string;
  public_id: string | null;
  alt: string;
  caption: string;
  sort_order: number;
  active: boolean;
}

export interface AboutContent {
  headline: string;
  subheading: string;
  body_html: string;
  image_url: string | null;
  image_public_id: string | null;
  stats: { label: string; value: string }[];
  team: { name: string; role: string; image_url?: string }[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface Stats {
  articles: number;
  published: number;
  drafts: number;
  carousel: number;
  categories: number;
}

export type WebhookEvent =
  | 'article.created'
  | 'article.updated'
  | 'article.published'
  | 'article.unpublished'
  | 'article.deleted'
  | 'article.*'
  | '*';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sourceIdentifier?: string;
  inbound_url?: string | null;
  is_inbound?: boolean;
  isInbound?: boolean; // For form handling
}

export interface WebhookEndpointListItem {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sourceIdentifier?: string;
  inbound_url?: string | null;
  is_inbound?: boolean;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: unknown;
  response_status: number | null;
  response_body: string | null;
  response_headers: Record<string, string> | null;
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface WebhookDeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  exhausted: number;
}

export interface WebhookTestRequest {
  endpoint_id: string;
  event_type?: WebhookEvent;
  payload?: Record<string, unknown>;
}

export interface WebhookTestResponse {
  success: boolean;
  status: number | null;
  response: string | null;
  error: string | null;
}
