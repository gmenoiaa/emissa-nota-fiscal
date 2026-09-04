import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { formatInvoiceDate } from './dates';
import { invoiceBalance } from './invoice-record';
import { invoiceIssuer } from './invoice-config';
import type { InvoiceRecord } from './types';

/**
 * The document is written in English because every recipient is a foreign
 * company and all previously issued invoices used English. Swap this map to
 * change the whole document language.
 */
const LABELS = {
  title: 'Invoice',
  from: 'From',
  to: 'To',
  invoiceNo: 'Invoice No.',
  date: 'Date',
  due: 'Invoice Due',
  description: 'Description',
  quantity: 'Quantity',
  rate: 'Rate',
  amount: 'Amount',
  subTotal: 'Sub Total',
  total: 'Total',
  paidToDate: 'Paid to Date',
  balance: 'Balance',
  note: 'Invoice Note',
  taxId: 'Tax ID',
  email: 'Email',
} as const;

const palette = {
  ink: '#18261f',
  muted: '#627068',
  line: '#dce4de',
  green: '#19643b',
  wash: '#f4f7f4',
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 48, paddingTop: 48, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 9.5, color: palette.ink, lineHeight: 1.5 },
  contractor: { fontSize: 8.5, color: palette.muted, marginBottom: 14 },
  eyebrow: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 1.4, color: palette.green },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  title: { fontFamily: 'Times-Bold', fontSize: 34, lineHeight: 1, color: palette.ink },
  reference: { fontFamily: 'Times-Bold', fontSize: 16, lineHeight: 1, color: palette.green },
  rule: { borderBottomWidth: 1, borderBottomColor: palette.line, marginTop: 18, marginBottom: 24 },

  parties: { flexDirection: 'row', justifyContent: 'space-between' },
  // The issuer street line is the widest text in the row, so From gets the space.
  party: { width: '42%' },
  partyTo: { width: '26%' },
  meta: { width: '26%' },
  blockLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.6, color: palette.muted, marginBottom: 5 },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  partyLine: { color: palette.muted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  metaKey: { color: palette.muted },
  metaValue: { fontFamily: 'Helvetica-Bold' },

  table: { marginTop: 26 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.ink, paddingBottom: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 10 },
  headCell: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.6, color: palette.muted },
  colDescription: { width: '52%' },
  colQuantity: { width: '12%', textAlign: 'right' },
  colRate: { width: '18%', textAlign: 'right' },
  colAmount: { width: '18%', textAlign: 'right' },

  totals: { marginTop: 14, marginLeft: 'auto', width: '48%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalKey: { color: palette.muted },
  totalValue: { fontFamily: 'Helvetica-Bold' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.line },
  grandKey: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  balanceBox: { marginTop: 10, backgroundColor: palette.green, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between' },
  balanceKey: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#ffffff' },
  balanceValue: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#ffffff' },

  noteBlock: { marginTop: 26, backgroundColor: palette.wash, borderRadius: 8, padding: 16 },
  noteText: { color: palette.muted, fontSize: 8.5, lineHeight: 1.6 },

  footer: { position: 'absolute', left: 48, right: 48, bottom: 32, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 },
  footerText: { fontSize: 8, color: palette.muted },
});

const amountFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatAmount(value: string): string {
  return amountFormat.format(Number(value));
}

export function InvoiceDocument({ record }: { record: InvoiceRecord }) {
  const money = (value: string) => `${record.currencyCode} ${formatAmount(value)}`;
  return (
    <Document
      title={record.reference}
      author={invoiceIssuer.name}
      subject={`${record.reference} · ${record.customerName}`}
    >
      <Page size="A4" style={styles.page}>
        {record.contractorLine ? <Text style={styles.contractor}>{record.contractorLine}</Text> : null}
        <Text style={styles.eyebrow}>GWM INFORMÁTICA · MARINGÁ</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{LABELS.title}</Text>
          <Text style={styles.reference}>{record.reference}</Text>
        </View>
        <View style={styles.rule} />

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.blockLabel}>{LABELS.from.toUpperCase()}</Text>
            <Text style={styles.partyName}>{invoiceIssuer.name}</Text>
            {invoiceIssuer.addressLines.map((line) => <Text key={line} style={styles.partyLine}>{line}</Text>)}
            <Text style={styles.partyLine}>{`${LABELS.taxId}: ${invoiceIssuer.taxId}`}</Text>
          </View>
          <View style={styles.partyTo}>
            <Text style={styles.blockLabel}>{LABELS.to.toUpperCase()}</Text>
            <Text style={styles.partyName}>{record.customerName}</Text>
            {record.billingAddress.map((line) => <Text key={line} style={styles.partyLine}>{line}</Text>)}
          </View>
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>{LABELS.invoiceNo}</Text>
              <Text style={styles.metaValue}>{record.reference}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>{LABELS.date}</Text>
              <Text style={styles.metaValue}>{formatInvoiceDate(record.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>{LABELS.due}</Text>
              <Text style={styles.metaValue}>{formatInvoiceDate(record.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.headCell, styles.colDescription]}>{LABELS.description.toUpperCase()}</Text>
            <Text style={[styles.headCell, styles.colQuantity]}>{LABELS.quantity.toUpperCase()}</Text>
            <Text style={[styles.headCell, styles.colRate]}>{LABELS.rate.toUpperCase()}</Text>
            <Text style={[styles.headCell, styles.colAmount]}>{LABELS.amount.toUpperCase()}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>{record.lineItem.description}</Text>
            <Text style={styles.colQuantity}>{String(record.lineItem.quantity)}</Text>
            <Text style={styles.colRate}>{formatAmount(record.lineItem.rate)}</Text>
            <Text style={styles.colAmount}>{money(record.total)}</Text>
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>{LABELS.subTotal}</Text>
            <Text style={styles.totalValue}>{formatAmount(record.total)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandKey}>{LABELS.total}</Text>
            <Text style={styles.grandValue}>{money(record.total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>{LABELS.paidToDate}</Text>
            <Text style={styles.totalValue}>{money(record.paidToDate)}</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceKey}>{LABELS.balance}</Text>
            <Text style={styles.balanceValue}>{money(invoiceBalance(record))}</Text>
          </View>
        </View>

        <View style={styles.noteBlock}>
          <Text style={styles.blockLabel}>{LABELS.note.toUpperCase()}</Text>
          <Text style={styles.noteText}>{record.note}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{`${LABELS.email}: ${invoiceIssuer.email}`}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function invoicePdfFilename(record: Pick<InvoiceRecord, 'reference'>): string {
  return `${record.reference}.pdf`;
}

export async function renderInvoicePdf(record: InvoiceRecord): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument record={record} />);
}
