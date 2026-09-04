const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Full timestamp with the Brazilian offset, as the DPS schema expects. */
export function brazilNowIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now).reduce<Record<string, string>>((all, item) => {
    all[item.type] = item.value;
    return all;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

export function brazilToday(now = new Date()): string {
  return brazilNowIso(now).slice(0, 10);
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(String(value).trim());
  if (!match) throw new Error('Informe a data no formato AAAA-MM-DD.');
  const [, year, month, day] = match;
  const parsed = { year: Number(year), month: Number(month), day: Number(day) };
  if (parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31) {
    throw new Error('Data inválida.');
  }
  return parsed;
}

export function assertIsoDate(value: string): string {
  parseIsoDate(value);
  return String(value).trim();
}

/** "2026-09-03" -> "Sep 03 2026", matching the layout of the reference invoices. */
export function formatInvoiceDate(value: string): string {
  const { year, month, day } = parseIsoDate(value);
  return `${MONTH_ABBREVIATIONS[month - 1]} ${String(day).padStart(2, '0')} ${year}`;
}

/** "2026-09-03" -> "Aug/2026": invoices always reference the month just closed. */
export function previousMonthReference(value: string): string {
  const { year, month } = parseIsoDate(value);
  const previous = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  return `${MONTH_ABBREVIATIONS[previous.month - 1]}/${previous.year}`;
}
