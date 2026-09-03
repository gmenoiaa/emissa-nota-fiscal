export type NfseEnvironment = 'restricted' | 'production';

export interface InvoiceInput {
  customerId: string;
  amount: string;
  description: string;
  competenceDate?: string;
  confirmProduction?: boolean;
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

