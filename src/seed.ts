import type { FinanceData } from './types';
import { snapshot } from './finance';
const now = new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const rates = { gold: 6_850_000, usd: 103_200, emami: 76_500_000, bahar: 71_300_000, updatedAt: now, source: 'manual' as const };
export const seed: FinanceData = {
  version: 1, rates,
  funds: [
    { id: 'treasury', title: 'خزانه طلا', balance: 0, percent: 20, color: '#d5b671' },
    { id: 'investment', title: 'سرمایه‌گذاری', balance: 350_000_000, percent: 25, color: '#9b8bda' },
    { id: 'debt', title: 'تأدیه دیون', balance: 95_000_000, percent: 10, color: '#df8b9e' },
    { id: 'daily', title: 'روزمره', balance: 76_800_000, percent: 20, color: '#76cdb5' },
    { id: 'saving', title: 'پس‌انداز', balance: 215_000_000, percent: 15, color: '#80b8d4' },
    { id: 'experience', title: 'تجربه و آموزش', balance: 45_000_000, percent: 10, color: '#ce9a74' },
  ],
  businesses: [
    { id: 'studio', title: 'استودیو طراحی متا', description: 'طراحی تجربه‌های دیجیتال برای برندهای آینده‌نگر', startDate: ago(330), initialCapital: 280_000_000, workingCapital: 410_000_000, reserveGold: 12.5, color: '#91a7cb' },
    { id: 'store', title: 'فروشگاه آنلاین', description: 'فروش محصولات منتخب خانه و سبک زندگی', startDate: ago(180), initialCapital: 450_000_000, workingCapital: 565_000_000, reserveGold: 8.2, color: '#d3ad75' },
    { id: 'consulting', title: 'مشاوره و توسعه', description: 'همراهی کسب‌وکارها در مسیر رشد پایدار', startDate: ago(90), initialCapital: 80_000_000, workingCapital: 135_000_000, reserveGold: 4, color: '#94baa2' },
  ],
  assets: [
    { id: 'home', title: 'آپارتمان مسکونی', category: 'املاک', purchasePrice: 5_600_000_000, value: 6_800_000_000, purchaseGold: 1120, purchasedAt: ago(480), status: 'active' },
    { id: 'car', title: 'خودروی شخصی', category: 'خودرو', purchasePrice: 1_400_000_000, value: 1_650_000_000, purchaseGold: 280, purchasedAt: ago(300), status: 'active' },
    { id: 'stocks', title: 'سبد سهام و صندوق‌ها', category: 'بورس', purchasePrice: 370_000_000, value: 485_000_000, purchaseGold: 70, purchasedAt: ago(200), status: 'active' },
    { id: 'equipment', title: 'تجهیزات استودیو', category: 'تجهیزات', purchasePrice: 185_000_000, value: 210_000_000, purchaseGold: 35, purchasedAt: ago(240), status: 'active' },
    { id: 'crypto', title: 'سبد رمزارز', category: 'رمزارز', purchasePrice: 220_000_000, value: 298_000_000, purchaseGold: 40, purchasedAt: ago(160), status: 'active' },
  ],
  vault: { gold: 165.5, usd: 12400 },
  transactions: [
    { id: 't1', kind: 'income', title: 'طراحی وب‌سایت برند آوان', ...snapshot(85_000_000, rates), date: ago(0), source: 'استودیو طراحی متا', category: 'پروژه', businessId: 'studio' },
    { id: 't2', kind: 'expense', title: 'اجاره دفتر کار', ...snapshot(18_000_000, rates), date: ago(1), source: 'روزمره', category: 'مسکن و دفتر', fundId: 'daily', businessId: 'studio' },
    { id: 't3', kind: 'income', title: 'فروش محصولات آبان', ...snapshot(64_500_000, rates), date: ago(2), source: 'فروشگاه آنلاین', category: 'فروش', businessId: 'store' },
    { id: 't4', kind: 'expense', title: 'خرید تجهیزات طراحی', ...snapshot(12_800_000, rates), date: ago(3), source: 'سرمایه‌گذاری', category: 'تجهیزات', fundId: 'investment', businessId: 'studio' },
    { id: 't5', kind: 'income', title: 'مشاوره استراتژی محصول', ...snapshot(36_000_000, rates), date: ago(4), source: 'مشاوره و توسعه', category: 'مشاوره', businessId: 'consulting' },
    { id: 't6', kind: 'expense', title: 'دوره مدیریت سرمایه', ...snapshot(4_500_000, rates), date: ago(5), source: 'تجربه و آموزش', category: 'آموزش', fundId: 'experience' },
    { id: 't7', kind: 'expense', title: 'هزینه‌های روزمره', ...snapshot(6_200_000, rates), date: ago(6), source: 'روزمره', category: 'زندگی', fundId: 'daily' },
    ...[155, 125, 95, 65, 35].flatMap((day, i) => [
      { id: `history-income-${i}`, kind: 'income' as const, title: 'دریافتی پروژه‌های ماه', ...snapshot([92, 128, 112, 168, 143][i] * 1e6, { ...rates, gold: 5_100_000 + i * 300_000, usd: 89_000 + i * 2500 }), date: ago(day), source: 'استودیو طراحی متا', category: 'پروژه', businessId: 'studio' },
      { id: `history-expense-${i}`, kind: 'expense' as const, title: 'هزینه‌های عملیاتی ماه', ...snapshot([43, 58, 38, 73, 52][i] * 1e6, { ...rates, gold: 5_100_000 + i * 300_000, usd: 89_000 + i * 2500 }), date: ago(day - 1), source: 'روزمره', category: 'مسکن و دفتر', businessId: 'studio', fundId: 'daily' },
    ]),
  ],
  vaultEntries: [
    { id: 'v1', currency: 'GOLD', direction: 'deposit', quantity: 10, source: 'درآمد پروژه', reason: 'حفظ ارزش سرمایه', memo: 'خرید طلای ۱۸ عیار بدون اجرت', date: ago(4), rate: 6_650_000 },
    { id: 'v2', currency: 'USD', direction: 'deposit', quantity: 1500, source: 'پس‌انداز شخصی', reason: 'تنوع‌بخشی ذخایر', memo: '', date: ago(9), rate: 101_800 },
  ],
  notes: [
    { id: 'n1', title: 'اول به خودت پرداخت کن', body: 'قبل از هر هزینه‌ای، سهم آینده‌ات را کنار بگذار. بودجه‌بندی درآمد در لحظه دریافت، اولین قدم برای ساختن آرامش مالی است.', tag: 'عادت‌های مالی', date: ago(1), pinned: true },
    { id: 'n2', title: 'طلا؛ یک خط‌کش برای ارزش', body: 'رشد عددی دارایی همیشه به معنای ثروتمندتر شدن نیست. ارزش دارایی‌هایت را با گرم طلا هم بسنج تا تصویر واقعی‌تری از قدرت خریدت داشته باشی.', tag: 'سرمایه‌گذاری', date: ago(3), pinned: false },
    { id: 'n3', title: 'صندوق اضطراری، نه انتخابی', body: 'برای هزینه‌های پیش‌بینی‌نشده، معادل سه تا شش ماه هزینه زندگی ذخیره کن. این صندوق باید نقدشونده و مستقل از سرمایه‌گذاری‌های بلندمدت باشد.', tag: 'برنامه‌ریزی', date: ago(5), pinned: false },
    { id: 'n4', title: 'درس این ماه: جریان نقدی', body: 'سود روی کاغذ با موجودی حساب متفاوت است. برای هر کسب‌وکار، زمان وصول درآمد و سررسید هزینه‌ها را جداگانه پیگیری کن.', tag: 'یادداشت شخصی', date: ago(8), pinned: false },
  ],
};
