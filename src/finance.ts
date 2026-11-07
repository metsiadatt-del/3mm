import type { Currency, FinanceData, Rates, Transaction } from "./types";
export const fa = (n: number, digits = 0) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(
        n,
      )
    : "—";
export const money = (n: number) => fa(n);
export const compact = (n: number) =>
  Math.abs(n) >= 1e9
    ? `${fa(n / 1e9, 2)} میلیارد`
    : Math.abs(n) >= 1e6
      ? `${fa(n / 1e6, 1)} میلیون`
      : fa(n);
export const jalali = (d: string | Date, full = false) =>
  new Intl.DateTimeFormat(
    "fa-IR-u-ca-persian",
    full
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  ).format(new Date(d));
export const parseNumber = (s: string) =>
  Number(
    s
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[,٬\s]/g, "")
      .replace("٫", "."),
  );
export const toToman = (amount: number, currency: Currency, rates: Rates) =>
  currency === "GOLD"
    ? amount * rates.gold
    : currency === "USD"
      ? amount * rates.usd
      : amount;
export function snapshot(amount: number, rates: Rates) {
  if (!(rates.gold > 0 && rates.usd > 0))
    throw new Error("ابتدا نرخ معتبر طلا و دلار را دریافت یا دستی ثبت کنید.");
  return {
    amount,
    gold: amount / rates.gold,
    usd: amount / rates.usd,
    rateGold: rates.gold,
    rateUsd: rates.usd,
  };
}
export function netWorth(d: FinanceData) {
  return (
    d.assets
      .filter((a) => a.status === "active")
      .reduce((s, a) => s + a.value, 0) +
    d.funds.reduce((s, f) => s + f.balance, 0) +
    d.vault.gold * d.rates.gold +
    d.vault.usd * d.rates.usd
  );
}
export function allocate(amount: number, funds: FinanceData["funds"]) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > Number.MAX_SAFE_INTEGER
  )
    throw new Error("مبلغ تخصیص باید مثبت و در محدوده مجاز باشد.");
  if (
    !funds.length ||
    funds.some(
      (f) => !Number.isFinite(f.percent) || f.percent < 0 || f.percent > 100,
    ) ||
    Math.abs(funds.reduce((s, f) => s + f.percent, 0) - 100) > 0.001
  )
    throw new Error("مجموع درصدهای بودجه‌بندی باید ۱۰۰ باشد.");
  const total = funds.reduce((s, f) => s + f.percent, 0);
  const portions = funds.map((f) => ({
    fundId: f.id,
    amount: Math.floor((amount * f.percent) / total),
    fraction: ((amount * f.percent) / total) % 1,
    percent: f.percent,
  }));
  const ranked = portions
    .filter((p) => p.percent > 0)
    .sort((a, b) => b.fraction - a.fraction);
  const remainder = amount - portions.reduce((s, p) => s + p.amount, 0);
  for (let i = 0; i < Math.floor(remainder); i++)
    ranked[i % ranked.length].amount += 1;
  ranked[0].amount += remainder - Math.floor(remainder);
  return portions.map(({ fundId, amount }) => ({ fundId, amount }));
}
export function addIncome(
  d: FinanceData,
  input: {
    title: string;
    amount: number;
    currency: Currency;
    source: string;
    businessId?: string;
    treasuryCurrency?: "GOLD" | "USD";
  },
): FinanceData {
  const amount = toToman(input.amount, input.currency, d.rates);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > Number.MAX_SAFE_INTEGER ||
    !input.title.trim() ||
    !input.source.trim()
  )
    throw new Error("عنوان، منبع و مبلغ مثبت و معتبر الزامی است.");
  const allocations = allocate(amount, d.funds);
  const treasury =
    allocations.find((a) => a.fundId === "treasury")?.amount ?? 0;
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    kind: "income",
    title: input.title,
    ...snapshot(amount, d.rates),
    date: new Date().toISOString(),
    source: input.source,
    category: "درآمد",
    businessId: input.businessId,
    allocations,
  };
  const currency = input.treasuryCurrency ?? "GOLD";
  const key = currency === "GOLD" ? "gold" : "usd";
  return {
    ...d,
    vault: { ...d.vault, [key]: d.vault[key] + treasury / d.rates[key] },
    vaultEntries:
      treasury > 0
        ? [
            {
              id: crypto.randomUUID(),
              currency,
              direction: "deposit",
              quantity: treasury / d.rates[key],
              source: input.source,
              reason: "تخصیص خودکار درآمد · BOP",
              memo: input.title,
              date: transaction.date,
              rate: d.rates[key],
              transactionId: transaction.id,
            },
            ...d.vaultEntries,
          ]
        : d.vaultEntries,
    funds: d.funds.map((f) => ({
      ...f,
      balance:
        f.balance +
        (f.id === "treasury"
          ? 0
          : allocations.find((a) => a.fundId === f.id)!.amount),
    })),
    transactions: [transaction, ...d.transactions],
  };
}
export function addExpense(
  d: FinanceData,
  input: {
    title: string;
    amount: number;
    fundId: string;
    category: string;
    businessId?: string;
  },
): FinanceData {
  const fund = d.funds.find(
    (f) => f.id === input.fundId && f.id !== "treasury",
  );
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    input.amount > Number.MAX_SAFE_INTEGER ||
    !input.title.trim()
  )
    throw new Error("عنوان و مبلغ مثبت و معتبر الزامی است.");
  if (!fund || fund.balance < input.amount)
    throw new Error("موجودی صندوق برای این هزینه کافی نیست.");
  return {
    ...d,
    funds: d.funds.map((f) =>
      f.id === fund.id ? { ...f, balance: f.balance - input.amount } : f,
    ),
    transactions: [
      {
        id: crypto.randomUUID(),
        kind: "expense",
        title: input.title,
        ...snapshot(input.amount, d.rates),
        date: new Date().toISOString(),
        source: fund.title,
        category: input.category,
        fundId: fund.id,
        businessId: input.businessId,
      },
      ...d.transactions,
    ],
  };
}
export function convertAsset(
  d: FinanceData,
  input: { assetId: string; amount: number; fundId: string },
): FinanceData {
  const asset = d.assets.find((a) => a.id === input.assetId);
  const fund = d.funds.find(
    (f) => f.id === input.fundId && f.id !== "treasury",
  );
  if (
    !asset ||
    asset.status !== "active" ||
    !fund ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    input.amount > Number.MAX_SAFE_INTEGER
  )
    throw new Error("دارایی، مبلغ فروش و صندوق مقصد را بررسی کنید.");
  return {
    ...d,
    assets: d.assets.map((a) =>
      a.id === asset.id
        ? { ...a, status: "sold", realizedGain: input.amount - a.purchasePrice }
        : a,
    ),
    funds: d.funds.map((f) =>
      f.id === fund.id ? { ...f, balance: f.balance + input.amount } : f,
    ),
    transactions: [
      {
        id: crypto.randomUUID(),
        kind: "conversion",
        title: `فروش ${asset.title}`,
        ...snapshot(input.amount, d.rates),
        date: new Date().toISOString(),
        source: fund.title,
        category: "تبدیل دارایی",
        fundId: fund.id,
        assetId: asset.id,
      },
      ...d.transactions,
    ],
  };
}
export function recordVault(
  d: FinanceData,
  input: {
    currency: "GOLD" | "USD";
    direction: "deposit" | "withdraw";
    quantity: number;
    fundId: string;
    source: string;
    reason: string;
    memo: string;
  },
): FinanceData {
  const key = input.currency === "GOLD" ? "gold" : "usd";
  const rate = d.rates[key];
  const value = input.quantity * rate;
  if (!(rate > 0)) throw new Error("ابتدا نرخ معتبر ذخیره را ثبت کنید.");
  const fund = d.funds.find(
    (f) => f.id === input.fundId && f.id !== "treasury",
  );
  if (
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isFinite(value) ||
    value > Number.MAX_SAFE_INTEGER ||
    !input.source.trim() ||
    !input.reason.trim()
  )
    throw new Error("مقدار مثبت و معتبر، منبع و دلیل الزامی است.");
  if (input.direction === "withdraw" && input.quantity > d.vault[key])
    throw new Error("موجودی خزانه کافی نیست.");
  if (input.direction === "deposit" && fund && value > fund.balance)
    throw new Error("موجودی صندوق مبدأ کافی نیست.");
  if (input.direction === "withdraw" && !fund)
    throw new Error("برای برداشت، صندوق مقصد را انتخاب کنید.");
  if (input.direction === "deposit" && !fund && input.fundId !== "external")
    throw new Error("صندوق مبدأ معتبر نیست.");
  return {
    ...d,
    vault: {
      ...d.vault,
      [key]:
        d.vault[key] +
        (input.direction === "deposit" ? input.quantity : -input.quantity),
    },
    funds: d.funds.map((f) =>
      f.id === fund?.id
        ? {
            ...f,
            balance:
              f.balance + (input.direction === "deposit" ? -value : value),
          }
        : f,
    ),
    vaultEntries: [
      {
        id: crypto.randomUUID(),
        currency: input.currency,
        direction: input.direction,
        quantity: input.quantity,
        source: input.source,
        reason: input.reason,
        memo: input.memo,
        date: new Date().toISOString(),
        rate,
        fundId: input.fundId,
      },
      ...d.vaultEntries,
    ],
  };
}
export function validateBackup(value: unknown): value is FinanceData {
  if (!value || typeof value !== "object") return false;
  const d = value as FinanceData;
  const positive = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  const nonnegative = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  const text = (v: unknown) => typeof v === "string";
  const date = (v: unknown) =>
    text(v) && Number.isFinite(Date.parse(v as string));
  const color = (v: unknown) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  if (
    ![
      d.funds,
      d.assets,
      d.businesses,
      d.transactions,
      d.vaultEntries,
      d.notes,
    ].every(
      (list) =>
        Array.isArray(list) &&
        list.every(
          (item) =>
            item &&
            typeof item === "object" &&
            text(item.id) &&
            item.id.length > 0,
        ) &&
        new Set(list.map((item) => item.id)).size === list.length,
    )
  )
    return false;
  const fundExists = (id: unknown) =>
    text(id) && d.funds.some((f) => f.id === id);
  if (
    d.transactions.some(
      (t) =>
        (t.fundId !== undefined && !fundExists(t.fundId)) ||
        (t.businessId !== undefined &&
          !d.businesses.some((b) => b.id === t.businessId)) ||
        (t.assetId !== undefined &&
          (t.kind !== "conversion" ||
            !d.assets.some(
              (a) => a.id === t.assetId && a.status === "sold",
            ))) ||
        (t.allocations !== undefined &&
          (!Array.isArray(t.allocations) ||
            t.kind !== "income" ||
            t.allocations.some(
              (a) => !a || !fundExists(a.fundId) || !nonnegative(a.amount),
            ) ||
            new Set(t.allocations.map((a) => a.fundId)).size !==
              t.allocations.length ||
            Math.abs(
              t.allocations.reduce((s, a) => s + a.amount, 0) - t.amount,
            ) > 0.001)),
    )
  )
    return false;
  if (
    d.vaultEntries.some(
      (v) =>
        (v.fundId !== undefined &&
          v.fundId !== "external" &&
          !fundExists(v.fundId)) ||
        (v.fundId === "external" && v.direction !== "deposit") ||
        (v.transactionId !== undefined &&
          (v.direction !== "deposit" ||
            v.fundId !== undefined ||
            !d.transactions.some(
              (t) =>
                t.id === v.transactionId &&
                t.kind === "income" &&
                t.allocations?.some(
                  (a) => a.fundId === "treasury" && a.amount > 0,
                ),
            ))),
    )
  )
    return false;
  return (
    d.version === 1 &&
    !!d.rates &&
    (["manual", "nerkhara", "iran-market"].includes(d.rates.source)
      ? ["gold", "usd", "emami", "bahar"].every((k) =>
          positive(d.rates[k as keyof Rates]),
        )
      : d.rates.source === "unset" &&
        ["gold", "usd", "emami", "bahar"].every(
          (k) => d.rates[k as keyof Rates] === 0,
        )) &&
    date(d.rates.updatedAt) &&
    !!d.vault &&
    nonnegative(d.vault.gold) &&
    nonnegative(d.vault.usd) &&
    Array.isArray(d.funds) &&
    d.funds.length > 0 &&
    new Set(d.funds.map((f) => f.id)).size === d.funds.length &&
    d.funds.some((f) => f.id === "treasury") &&
    d.funds.every(
      (f) =>
        text(f.id) &&
        text(f.title) &&
        nonnegative(f.balance) &&
        nonnegative(f.percent) &&
        f.percent <= 100 &&
        color(f.color),
    ) &&
    Math.abs(d.funds.reduce((s, f) => s + f.percent, 0) - 100) < 0.001 &&
    Array.isArray(d.assets) &&
    d.assets.every(
      (a) =>
        text(a.id) &&
        text(a.title) &&
        text(a.category) &&
        nonnegative(a.value) &&
        nonnegative(a.purchasePrice) &&
        nonnegative(a.purchaseGold) &&
        date(a.purchasedAt) &&
        ["active", "sold"].includes(a.status),
    ) &&
    Array.isArray(d.businesses) &&
    d.businesses.every(
      (b) =>
        text(b.id) &&
        text(b.title) &&
        text(b.description) &&
        color(b.color) &&
        date(b.startDate) &&
        nonnegative(b.initialCapital) &&
        nonnegative(b.workingCapital) &&
        nonnegative(b.reserveGold),
    ) &&
    Array.isArray(d.transactions) &&
    d.transactions.every(
      (t) =>
        text(t.id) &&
        text(t.title) &&
        text(t.source) &&
        text(t.category) &&
        ["income", "expense", "conversion"].includes(t.kind) &&
        positive(t.amount) &&
        nonnegative(t.gold) &&
        nonnegative(t.usd) &&
        positive(t.rateGold) &&
        positive(t.rateUsd) &&
        date(t.date),
    ) &&
    Array.isArray(d.vaultEntries) &&
    d.vaultEntries.every(
      (v) =>
        text(v.id) &&
        ["GOLD", "USD"].includes(v.currency) &&
        ["deposit", "withdraw"].includes(v.direction) &&
        positive(v.quantity) &&
        positive(v.rate) &&
        text(v.source) &&
        text(v.reason) &&
        text(v.memo) &&
        date(v.date),
    ) &&
    Array.isArray(d.notes) &&
    d.notes.every(
      (n) =>
        text(n.id) &&
        text(n.title) &&
        text(n.body) &&
        text(n.tag) &&
        date(n.date) &&
        typeof n.pinned === "boolean",
    )
  );
}
