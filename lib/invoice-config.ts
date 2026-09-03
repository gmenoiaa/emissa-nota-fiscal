import type { Customer } from './types';

export const fixedInvoice = {
  version: '1.01',
  cityCode: '4115200',
  providerCnpj: '28220610000110',
  series: '70000',
  taxRegime: { simplesOption: '3', simplesAssessment: '1', specialRegime: '0' },
  service: { nationalCode: '080201', municipalCode: '006', nbs: '999999999' },
  foreignTrade: { serviceMode: '4', relationship: '0', temporaryGoodsMovement: '1', mdic: '0' },
  taxes: { issqn: '3', issWithholding: '1', pisCofinsCst: '00', approximateSimpleRate: '6.00' },
} as const;

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
