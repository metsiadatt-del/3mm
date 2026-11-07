import type { Transaction } from './types';
import type { SheetData } from 'write-excel-file/browser';
import { jalali } from './finance';
export const reportHeaders = ['عنوان', 'نوع', 'مبلغ (تومان)', 'معادل طلا (گرم)', 'معادل دلار', 'منبع', 'تاریخ شمسی', 'زمان ISO', 'نرخ تاریخی طلا (تومان)', 'نرخ تاریخی دلار (تومان)'];
export function reportTransactions(transactions: Transaction[], from: string, to: string, kind: string) {
  const start = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
  const endDate = to ? new Date(`${to}T00:00:00`) : null;
  endDate?.setDate(endDate.getDate() + 1);
  const end = endDate?.getTime() ?? Infinity;
  return transactions.filter(t => (kind === 'all' || t.kind === kind) && new Date(t.date).getTime() >= start && new Date(t.date).getTime() < end).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
export function reportValues(rows: Transaction[]) {
  return rows.map(t => [t.title, t.kind === 'income' ? 'درآمد' : t.kind === 'expense' ? 'هزینه' : 'تبدیل دارایی', t.amount, t.gold, t.usd, t.source, jalali(t.date), t.date, t.rateGold, t.rateUsd]);
}
export function createCsvReport(rows: Transaction[]) {
  const escape = (value: string | number) => {
    let text = String(value);
    if (typeof value === 'string' && /^\s*[=+@\-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [reportHeaders, ...reportValues(rows)].map(row => row.map(escape).join(',')).join('\r\n');
}
export async function createExcelReport(rows: Transaction[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sheet: SheetData = [
    reportHeaders.map(value => ({ value, type: String, fontWeight: 'bold', backgroundColor: '#D5E9DC', color: '#244936', align: 'right' })),
    ...reportValues(rows).map(row => row.map(value => typeof value === 'number' ? { value, type: Number, format: '#,##0.###;(#,##0.###);-' } : { value, type: String, align: 'right' as const })),
  ];
  return writeXlsxFile(sheet, { sheet: 'گزارش مالی', rightToLeft: true, stickyRowsCount: 1, columns: [35,15,22,19,19,28,20,28,24,24].map(width => ({ width })) }, { fontFamily: 'Arial', fontSize: 11 }).toBlob();
}
