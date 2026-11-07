import { addExpense, addIncome, convertAsset, recordVault } from "./finance";
import type { FinanceData, Transaction, VaultEntry } from "./types";
export type Entity =
  "transaction" | "vault" | "business" | "asset" | "note" | "fund";
function balances(
  d: FinanceData,
  changes: Record<string, number>,
  gold = 0,
  usd = 0,
): FinanceData {
  for (const id of Object.keys(changes))
    if (!d.funds.some((f) => f.id === id))
      throw new Error("صندوق مرتبط دیگر وجود ندارد.");
  const funds = d.funds.map((f) => ({
    ...f,
    balance: f.balance + (changes[f.id] ?? 0),
  }));
  const vault = { gold: d.vault.gold + gold, usd: d.vault.usd + usd };
  if (
    funds.some((f) => f.balance < -0.000001) ||
    vault.gold < -0.000001 ||
    vault.usd < -0.000001
  )
    throw new Error(
      "موجودی مرتبط مصرف شده است؛ ابتدا عملیات بعدی را اصلاح کنید.",
    );
  return {
    ...d,
    funds: funds.map((f) => ({ ...f, balance: Math.max(0, f.balance) })),
    vault: { gold: Math.max(0, vault.gold), usd: Math.max(0, vault.usd) },
  };
}
function reverseVault(d: FinanceData, v: VaultEntry): FinanceData {
  if (!v.fundId)
    throw new Error(
      "این رکورد قدیمی صندوق مبدأ مشخصی ندارد؛ فقط اطلاعات توضیحی قابل ویرایش است.",
    );
  const sign = v.direction === "deposit" ? -1 : 1;
  const changes =
    v.fundId === "external" ? {} : { [v.fundId]: -sign * v.quantity * v.rate };
  const next = balances(
    d,
    changes,
    v.currency === "GOLD" ? sign * v.quantity : 0,
    v.currency === "USD" ? sign * v.quantity : 0,
  );
  return {
    ...next,
    vaultEntries: next.vaultEntries.filter((e) => e.id !== v.id),
  };
}
export function removeTransaction(d: FinanceData, id: string): FinanceData {
  const t = d.transactions.find((t) => t.id === id);
  if (!t) throw new Error("تراکنش پیدا نشد.");
  let next = d;
  if (t.kind === "income") {
    if (!t.allocations)
      throw new Error(
        "تخصیص تاریخی این درآمد مشخص نیست؛ حذف مالی امن ممکن نیست.",
      );
    const treasury =
      t.allocations.find((a) => a.fundId === "treasury")?.amount ?? 0;
    const entries = d.vaultEntries.filter((v) => v.transactionId === t.id);
    if (treasury > 0 && !entries.length)
      throw new Error(
        "پیوند تاریخی خزانه برای این درآمد موجود نیست؛ حذف مالی امن ممکن نیست.",
      );
    const changes = Object.fromEntries(
      t.allocations
        .filter((a) => a.fundId !== "treasury")
        .map((a) => [a.fundId, -a.amount]),
    );
    next = balances(
      d,
      changes,
      -entries
        .filter((v) => v.currency === "GOLD")
        .reduce((s, v) => s + v.quantity, 0),
      -entries
        .filter((v) => v.currency === "USD")
        .reduce((s, v) => s + v.quantity, 0),
    );
    next = {
      ...next,
      vaultEntries: next.vaultEntries.filter((v) => v.transactionId !== id),
    };
  } else {
    if (!t.fundId || (t.kind === "conversion" && !t.assetId))
      throw new Error(
        "پیوند حسابداری رکورد قدیمی کامل نیست؛ حذف مالی امن ممکن نیست.",
      );
    next = balances(d, {
      [t.fundId]: t.kind === "expense" ? t.amount : -t.amount,
    });
    if (t.kind === "conversion")
      next = {
        ...next,
        assets: next.assets.map((a) =>
          a.id === t.assetId
            ? { ...a, status: "active", realizedGain: undefined }
            : a,
        ),
      };
  }
  return {
    ...next,
    transactions: next.transactions.filter((row) => row.id !== id),
  };
}
export function editTransaction(
  d: FinanceData,
  id: string,
  input: Pick<Transaction, "title" | "amount" | "source" | "category"> & {
    fundId?: string;
  },
): FinanceData {
  const old = d.transactions.find((t) => t.id === id);
  if (!old) throw new Error("تراکنش پیدا نشد.");
  if (
    !input.title.trim() ||
    !input.source.trim() ||
    !input.category.trim() ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    input.amount > Number.MAX_SAFE_INTEGER
  )
    throw new Error("عنوان، منبع، دسته‌بندی و مبلغ مثبت و معتبر الزامی است.");
  if (
    old.amount === input.amount &&
    (!input.fundId || input.fundId === old.fundId)
  )
    return {
      ...d,
      transactions: d.transactions.map((t) =>
        t.id === id ? { ...t, ...input } : t,
      ),
    };
  const linked = d.vaultEntries.find((v) => v.transactionId === id);
  let next = removeTransaction(d, id);
  const rates = next.rates;
  next = { ...next, rates: { ...rates, gold: old.rateGold, usd: old.rateUsd } };
  if (old.kind === "income") {
    const funds = next.funds;
    next = addIncome(
      {
        ...next,
        funds: funds.map((f) => ({
          ...f,
          percent:
            ((old.allocations?.find((a) => a.fundId === f.id)?.amount ?? 0) /
              old.amount) *
            100,
        })),
      },
      {
        ...input,
        currency: "TMN",
        businessId: old.businessId,
        treasuryCurrency: linked?.currency,
      },
    );
    next = {
      ...next,
      funds: next.funds.map((f) => ({
        ...f,
        percent: funds.find((a) => a.id === f.id)!.percent,
      })),
    };
  } else if (old.kind === "expense")
    next = addExpense(next, {
      ...input,
      fundId: input.fundId ?? old.fundId!,
      businessId: old.businessId,
    });
  else
    next = convertAsset(next, {
      amount: input.amount,
      assetId: old.assetId!,
      fundId: input.fundId ?? old.fundId!,
    });
  const created = next.transactions[0];
  return {
    ...next,
    rates,
    transactions: next.transactions.map((t) =>
      t.id === created.id ? { ...t, ...input, id, date: old.date } : t,
    ),
    vaultEntries: next.vaultEntries.map((v) =>
      v.transactionId === created.id
        ? { ...v, transactionId: id, date: old.date }
        : v,
    ),
  };
}
export function editVault(
  d: FinanceData,
  id: string,
  input: Parameters<typeof recordVault>[1],
): FinanceData {
  const old = d.vaultEntries.find((v) => v.id === id);
  if (!old) throw new Error("رکورد پیدا نشد.");
  if (!input.source.trim() || !input.reason.trim())
    throw new Error("منبع و دلیل الزامی است.");
  if (old.transactionId)
    throw new Error("این گردش به درآمد متصل است؛ درآمد مرتبط را ویرایش کنید.");
  if (
    old.quantity === input.quantity &&
    old.currency === input.currency &&
    old.direction === input.direction &&
    (!old.fundId || old.fundId === input.fundId)
  )
    return {
      ...d,
      vaultEntries: d.vaultEntries.map((v) =>
        v.id === id
          ? {
              ...v,
              source: input.source,
              reason: input.reason,
              memo: input.memo,
            }
          : v,
      ),
    };
  const reversed = reverseVault(d, old);
  const key = input.currency === "GOLD" ? "gold" : "usd";
  const next = recordVault(
    {
      ...reversed,
      rates: {
        ...d.rates,
        [key]: old.currency === input.currency ? old.rate : d.rates[key],
      },
    },
    input,
  );
  return {
    ...next,
    rates: d.rates,
    vaultEntries: next.vaultEntries.map((v, i) =>
      i === 0 ? { ...v, id, date: old.date } : v,
    ),
  };
}
export function deleteRecord(
  d: FinanceData,
  entity: Entity,
  id: string,
): FinanceData {
  if (entity === "transaction") return removeTransaction(d, id);
  if (entity === "vault") {
    const v = d.vaultEntries.find((v) => v.id === id);
    if (!v) throw new Error("رکورد پیدا نشد.");
    if (v.transactionId)
      throw new Error("گردش خودکار خزانه را از طریق درآمد مرتبط حذف کنید.");
    return reverseVault(d, v);
  }
  if (entity === "note")
    return { ...d, notes: d.notes.filter((n) => n.id !== id) };
  if (entity === "business")
    return {
      ...d,
      businesses: d.businesses.filter((b) => b.id !== id),
      transactions: d.transactions.map((t) =>
        t.businessId === id ? { ...t, businessId: undefined } : t,
      ),
    };
  if (entity === "asset") {
    if (d.assets.find((a) => a.id === id)?.status === "sold")
      throw new Error(
        "ابتدا تراکنش فروش مرتبط را حذف کنید تا دارایی دوباره فعال شود.",
      );
    return { ...d, assets: d.assets.filter((a) => a.id !== id) };
  }
  const fund = d.funds.find((f) => f.id === id);
  if (
    !fund ||
    id === "treasury" ||
    fund.balance ||
    fund.percent ||
    d.transactions.some(
      (t) => t.fundId === id || t.allocations?.some((a) => a.fundId === id),
    ) ||
    d.vaultEntries.some((v) => v.fundId === id)
  )
    throw new Error(
      "فقط صندوق بدون موجودی، سهم بودجه و سابقه مالی قابل حذف است؛ خزانه حذف نمی‌شود.",
    );
  return { ...d, funds: d.funds.filter((f) => f.id !== id) };
}
