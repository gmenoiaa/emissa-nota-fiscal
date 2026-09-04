export type NfseEnvironment = 'restricted' | 'production';

export interface InvoiceInput {
  customerId: string;
  amount: string;
  description: string;
  competenceDate?: string;
  confirmProduction?: boolean;
  /** Commercial invoice this NFS-e was issued for, when it came from /invoices. */
  invoiceNumber?: number;
}

export interface CustomerAddress {
  country: string;
  countryName: string;
  postalCode: string;
  city: string;
  region: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
}

export interface Customer {
  id: string;
  name: string;
  currency: { numericCode: string; code: string; foreignAmount: string };
  paymentMechanisms: { provider: string; customer: string };
  displayAddress: string;
  address: CustomerAddress;
  invoice: InvoiceProfile;
}

export interface LoadedCertificate {
  pfx: Buffer;
  passphrase: string;
  privateKeyPem: string;
  certificatePem: string;
}

export interface NfseApiError extends Error {
  status?: number;
  details?: unknown;
}

export interface InvoiceEmailProfile {
  to: string[];
  /** Cima is billed by the staffing agency's own flow, so it never auto-sends. */
  sendByDefault: boolean;
}

export interface InvoiceProfile {
  /** Legal name printed on the invoice, which may differ from the fiscal name. */
  billingName: string;
  billingAddress: string[];
  /** Extra line above the header, used only where the client asks for it. */
  contractorLine?: string;
  lineItemDescription: string;
  includeWireInformation: boolean;
  email: InvoiceEmailProfile;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: string;
}

export interface InvoiceEmailReceipt {
  sentAt: string;
  to: string[];
  messageId: string;
}

export interface InvoiceNfseLink {
  dpsNumber: number;
  accessKey: string | null;
  linkedAt: string;
}

export type InvoiceStatus = 'issued' | 'paid' | 'void';

/**
 * A snapshot of everything printed on one invoice. Values are copied at creation
 * time on purpose: editing a customer profile later must never alter a document
 * that was already sent to that customer.
 */
export interface InvoiceRecord {
  number: number;
  reference: string;
  customerId: string;
  customerName: string;
  billingAddress: string[];
  contractorLine?: string;
  lineItem: InvoiceLineItem;
  currencyCode: string;
  total: string;
  paidToDate: string;
  issueDate: string;
  dueDate: string;
  note: string;
  status: InvoiceStatus;
  createdAt: string;
  email: InvoiceEmailReceipt | null;
  nfse: InvoiceNfseLink | null;
}

export interface InvoiceInputPayload {
  customerId: string;
  lineItemDescription?: string;
  quantity?: string;
  rate?: string;
  issueDate?: string;
  dueDate?: string;
  referencePeriod?: string;
  note?: string;
}
