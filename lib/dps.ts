import { brazilNowIso } from './dates';
import { fixedInvoice as fixed, getNfseCustomer } from './invoice-config';
import type { InvoiceInput, NfseEnvironment } from './types';

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function normalizeMoney(value: string): string {
  const normalized = String(value).trim().replace(/\s/g, '').replace(/\.(?=.*[.,])/g, '').replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor maior que zero.');
  return amount.toFixed(2);
}

export interface BuildDpsOptions {
  dpsNumber: number;
  environment?: NfseEnvironment;
  issuedAt?: string;
}

export function buildDps(input: InvoiceInput, options: BuildDpsOptions): string {
  const description = String(input.description || '').trim();
  if (!description) throw new Error('Informe a descrição ou número da invoice.');

  const customer = getNfseCustomer(String(input.customerId || ''));
  const address = customer.address;
  const amount = normalizeMoney(input.amount);
  const dpsNumber = String(options?.dpsNumber ?? '');
  if (!/^\d{1,15}$/.test(dpsNumber) || Number(dpsNumber) < 1) {
    throw new Error('O número da DPS deve conter de 1 a 15 dígitos.');
  }
  const environment = options.environment === 'production' ? '1' : '2';
  const issuedAt = options.issuedAt || brazilNowIso();
  const competenceDate = input.competenceDate || issuedAt.slice(0, 10);
  const id = `DPS${fixed.cityCode}2${fixed.providerCnpj.padStart(14, '0')}${fixed.series.padStart(5, '0')}${dpsNumber.padStart(15, '0')}`;
  const complement = address.complement ? `\n        <xCpl>${escapeXml(address.complement)}</xCpl>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="${fixed.version}">
  <infDPS Id="${id}">
    <tpAmb>${environment}</tpAmb>
    <dhEmi>${issuedAt}</dhEmi>
    <verAplic>EmissaoNota_1.0.0</verAplic>
    <serie>${fixed.series}</serie>
    <nDPS>${dpsNumber}</nDPS>
    <dCompet>${competenceDate}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${fixed.cityCode}</cLocEmi>
    <prest>
      <CNPJ>${fixed.providerCnpj}</CNPJ>
      <regTrib>
        <opSimpNac>${fixed.taxRegime.simplesOption}</opSimpNac>
        <regApTribSN>${fixed.taxRegime.simplesAssessment}</regApTribSN>
        <regEspTrib>${fixed.taxRegime.specialRegime}</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      <cNaoNIF>2</cNaoNIF>
      <xNome>${escapeXml(customer.name)}</xNome>
      <end>
        <endExt>
          <cPais>${escapeXml(address.country)}</cPais>
          <cEndPost>${escapeXml(address.postalCode)}</cEndPost>
          <xCidade>${escapeXml(address.city)}</xCidade>
          <xEstProvReg>${escapeXml(address.region)}</xEstProvReg>
        </endExt>
        <xLgr>${escapeXml(address.street)}</xLgr>
        <nro>${escapeXml(address.number)}</nro>${complement}
        <xBairro>${escapeXml(address.district)}</xBairro>
      </end>
    </toma>
    <serv>
      <locPrest><cLocPrestacao>${fixed.cityCode}</cLocPrestacao></locPrest>
      <cServ>
        <cTribNac>${fixed.service.nationalCode}</cTribNac>
        <cTribMun>${fixed.service.municipalCode}</cTribMun>
        <xDescServ>${escapeXml(description)}</xDescServ>
        <cNBS>${fixed.service.nbs}</cNBS>
      </cServ>
      <comExt>
        <mdPrestacao>${fixed.foreignTrade.serviceMode}</mdPrestacao>
        <vincPrest>${fixed.foreignTrade.relationship}</vincPrest>
        <tpMoeda>${customer.currency.numericCode}</tpMoeda>
        <vServMoeda>${customer.currency.foreignAmount}</vServMoeda>
        <mecAFComexP>${customer.paymentMechanisms.provider}</mecAFComexP>
        <mecAFComexT>${customer.paymentMechanisms.customer}</mecAFComexT>
        <movTempBens>${fixed.foreignTrade.temporaryGoodsMovement}</movTempBens>
        <mdic>${fixed.foreignTrade.mdic}</mdic>
      </comExt>
    </serv>
    <valores>
      <vServPrest><vServ>${amount}</vServ></vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>${fixed.taxes.issqn}</tribISSQN>
          <cPaisResult>${escapeXml(address.country)}</cPaisResult>
          <tpRetISSQN>${fixed.taxes.issWithholding}</tpRetISSQN>
        </tribMun>
        <tribFed><piscofins><CST>${fixed.taxes.pisCofinsCst}</CST></piscofins></tribFed>
        <totTrib><pTotTribSN>${fixed.taxes.approximateSimpleRate}</pTotTribSN></totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}

/** Optional back-reference to a commercial invoice; never affects the DPS itself. */
function parseLinkedInvoiceNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

export function parseInvoiceInput(value: unknown): InvoiceInput {
  if (!value || typeof value !== 'object') throw new Error('Dados da nota inválidos.');
  const input = value as Record<string, unknown>;
  return {
    customerId: String(input.customerId || ''),
    amount: String(input.amount || ''),
    description: String(input.description || ''),
    competenceDate: input.competenceDate ? String(input.competenceDate) : undefined,
    confirmProduction: input.confirmProduction === true,
    invoiceNumber: parseLinkedInvoiceNumber(input.invoiceNumber),
  };
}
