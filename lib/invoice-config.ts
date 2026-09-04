import type { Customer } from './types';

/** Fixed fiscal parameters for the NFS-e (DPS) document, not for commercial invoices. */
export const fixedInvoice = {
  version: '1.01',
  cityCode: '4115200',
  providerCnpj: '28220610000110',
  // 00001-49999 is the official range for DPS issued by the taxpayer's own app.
  // The 70000-79999 range belongs exclusively to the national Web Issuer.
  series: '1',
  taxRegime: { simplesOption: '3', simplesAssessment: '1', specialRegime: '0' },
  service: { nationalCode: '080201', municipalCode: '006', nbs: '999999999' },
  foreignTrade: { serviceMode: '4', relationship: '0', temporaryGoodsMovement: '1', mdic: '0' },
  taxes: { issqn: '3', issWithholding: '1', pisCofinsCst: '00', approximateSimpleRate: '6.00' },
} as const;

/** The "From" block printed on every commercial invoice. */
export const invoiceIssuer = {
  name: 'Gwm Informatica Ltda',
  addressLines: [
    'Av. Horacio Raccanello Filho 5415, Apto 1505',
    'Maringá, PR, 87020035',
    'Brazil',
  ],
  taxId: '28.220.610/0001-10',
  email: 'gwminfoltda@gmail.com',
} as const;

/** Reused verbatim from INV-1036. */
export const wireInformation = [
  'Wire information:',
  'Beneficiary: GWM INFORMATICA LTDA',
  'Beneficiary Address: Maringá, Brazil',
  'Beneficiary Account Number (IBAN): BR5178632767000010003989101C1 SWIFT Code: OURIBRSPXXX',
  'Bank Name: BANCO OURINVEST S.A.',
  'Bank Address: Sao Paulo, Brazil',
] as const;

export const customers: Customer[] = [
  {
    id: 'apideck', name: 'apideck',
    currency: { numericCode: '978', code: 'EUR', foreignAmount: '6500.00' },
    paymentMechanisms: { provider: '01', customer: '01' },
    displayAddress: 'Broederminstraat 9 · 2018 Antwerp · Antwerp, Bélgica',
    address: {
      country: 'BE', countryName: 'Bélgica', postalCode: '2018', city: 'Antwerp', region: 'Antwerp',
      street: 'Broederminstraat', number: '9', district: 'N/A',
    },
    invoice: {
      billingName: 'Apideck',
      // Same location as the fiscal address above, written the way the invoice
      // prints it (English country name). Keep the two in sync.
      billingAddress: ['Broederminstraat 9', '2018 Antwerp', 'Belgium'],
      lineItemDescription: 'Consultancy fixed monthly rate',
      includeWireInformation: true,
      email: { to: ['ap@apideck.com'], sendByDefault: true },
    },
  },
  {
    id: 'cima', name: 'Cima Staffing',
    currency: { numericCode: '840', code: 'USD', foreignAmount: '8000.00' },
    paymentMechanisms: { provider: '01', customer: '01' },
    displayAddress: 'Continental Drive 200, Suite 401 · 19731 Newark · Delaware, Estados Unidos',
    address: {
      country: 'US', countryName: 'Estados Unidos', postalCode: '19731', city: 'Newark', region: 'Delaware',
      street: 'Continental Drive , 200 /Suite 401 , Bairro N/A , Endereço Postal 19731 , Newark , Delaware, País Estados Unidos',
      number: '200', complement: 'Suite 401', district: 'N/A',
    },
    invoice: {
      billingName: 'Cima Staffing',
      billingAddress: ['200 Continental Drive Suite 401', 'Newark, DE, 19731', 'United States'],
      contractorLine: 'Contractor Geiser Wilian Menoia',
      lineItemDescription: 'Software Development Services',
      includeWireInformation: false,
      email: { to: [], sendByDefault: false },
    },
  },
];

export function getCustomer(customerId: string): Customer {
  const customer = customers.find(({ id }) => id === customerId);
  if (!customer) throw new Error('Selecione uma empresa cadastrada.');
  return customer;
}

export function getPublicCustomers() {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    currencyCode: customer.currency.code,
    foreignAmount: customer.currency.foreignAmount,
    displayAddress: customer.displayAddress,
    countryName: customer.address.countryName,
  }));
}

/** Defaults the invoice form starts from; the rate mirrors the DPS foreign amount. */
export function getInvoiceCustomerDefaults() {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.invoice.billingName,
    currencyCode: customer.currency.code,
    rate: customer.currency.foreignAmount,
    lineItemDescription: customer.invoice.lineItemDescription,
    billingAddress: customer.invoice.billingAddress,
    emailTo: customer.invoice.email.to,
    sendByDefault: customer.invoice.email.sendByDefault,
  }));
}
