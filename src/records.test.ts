import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./seed";
import { seed as fixture } from "./test-fixtures";
import {
  addIncome,
  addExpense,
  convertAsset,
  recordVault,
  netWorth,
  snapshot,
  validateBackup,
} from "./finance";
import { deleteRecord, editTransaction, editVault } from "./records";
const fresh = () => structuredClone(fixture);
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 0.0001, `${a} != ${b}`);
test("Production starts empty with no fabricated rates and validates its own backup", () => {
  assert.equal(
    seed.transactions.length +
      seed.assets.length +
      seed.businesses.length +
      seed.notes.length +
      seed.vaultEntries.length,
    0,
  );
  assert.equal(netWorth(seed), 0);
  assert.ok(validateBackup(seed));
  assert.throws(() => snapshot(100, seed.rates), /نرخ/);
});
test("Deleting income reverses original allocations and its linked treasury, not current budget or rates", () => {
  const before = fresh();
  const added = addIncome(before, {
    title: "درآمد",
    source: "منبع",
    amount: 1000000,
    currency: "TMN",
    treasuryCurrency: "USD",
  });
  added.rates = { ...added.rates, usd: added.rates.usd * 2 };
  const removed = deleteRecord(added, "transaction", added.transactions[0].id);
  assert.deepEqual(removed.funds, before.funds);
  near(removed.vault.usd, before.vault.usd);
  assert.deepEqual(removed.transactions, before.transactions);
  assert.deepEqual(removed.vaultEntries, before.vaultEntries);
});
test("Editing income preserves historical rates and original shares without a duplicate treasury entry", () => {
  const added = addIncome(fresh(), {
    title: "درآمد",
    source: "منبع",
    amount: 1000000,
    currency: "TMN",
  });
  const t = added.transactions[0];
  const input = {
    title: "اصلاح",
    source: "منبع",
    category: t.category,
    amount: 2000000,
  };
  added.rates = { ...added.rates, gold: added.rates.gold * 2 };
  const edited = editTransaction(added, t.id, input);
  assert.equal(edited.transactions[0].rateGold, t.rateGold);
  assert.equal(edited.transactions[0].id, t.id);
  assert.equal(edited.transactions[0].date, t.date);
  assert.equal(
    edited.vaultEntries.filter((v) => v.transactionId === t.id).length,
    1,
  );
  near(edited.vaultEntries[0].quantity, 400000 / t.rateGold);
  assert.equal(edited.rates.gold, added.rates.gold);
  assert.ok(validateBackup(edited));
});
test("Deleting spent income is atomic and leaves input untouched", () => {
  const base = structuredClone(seed);
  base.rates = fixture.rates;
  const added = addIncome(base, {
    title: "درآمد",
    source: "منبع",
    amount: 1000000,
    currency: "TMN",
  });
  const spent = addExpense(added, {
    title: "هزینه",
    amount: 200000,
    fundId: "daily",
    category: "سایر",
  });
  const before = structuredClone(spent);
  assert.throws(
    () => deleteRecord(spent, "transaction", added.transactions[0].id),
    /مصرف/,
  );
  assert.deepEqual(spent, before);
});
test("Expense edit refunds old fund and charges new fund once, deletion refunds edited value", () => {
  const before = fresh();
  const added = addExpense(before, {
    title: "هزینه",
    amount: 1000,
    fundId: "daily",
    category: "سایر",
  });
  const t = added.transactions[0];
  const edited = editTransaction(added, t.id, {
    title: "اصلاح",
    source: "پس‌انداز",
    category: "سایر",
    amount: 2000,
    fundId: "saving",
  });
  assert.equal(
    edited.funds.find((f) => f.id === "daily")!.balance,
    before.funds.find((f) => f.id === "daily")!.balance,
  );
  assert.deepEqual(
    deleteRecord(edited, "transaction", t.id).funds,
    before.funds,
  );
});
test("Asset sale edit and reversal preserve asset state and remove proceeds", () => {
  const before = fresh();
  const added = convertAsset(before, {
    assetId: "car",
    fundId: "saving",
    amount: 1700000000,
  });
  const t = added.transactions[0];
  const edited = editTransaction(added, t.id, {
    title: t.title,
    source: t.source,
    category: t.category,
    amount: 1800000000,
    fundId: "saving",
  });
  assert.equal(
    edited.assets.find((a) => a.id === "car")!.realizedGain,
    400000000,
  );
  assert.throws(() => deleteRecord(edited, "asset", "car"), /فروش/);
  const removed = deleteRecord(edited, "transaction", t.id);
  assert.equal(removed.assets.find((a) => a.id === "car")!.status, "active");
  assert.deepEqual(removed.funds, before.funds);
});
test("Vault edit uses historical rate and delete restores funds and reserves", () => {
  const before = fresh();
  const input = {
    currency: "GOLD" as const,
    direction: "deposit" as const,
    quantity: 1,
    fundId: "saving",
    source: "منبع",
    reason: "دلیل",
    memo: "",
  };
  const added = recordVault(before, input);
  const id = added.vaultEntries[0].id;
  const edited = editVault(
    { ...added, rates: { ...added.rates, gold: added.rates.gold * 2 } },
    id,
    { ...input, quantity: 2 },
  );
  assert.equal(edited.vaultEntries[0].rate, before.rates.gold);
  const removed = deleteRecord(edited, "vault", id);
  assert.deepEqual(removed.funds, before.funds);
  near(removed.vault.gold, before.vault.gold);
});
test("Linked automatic vault entries cannot be independently deleted or edited", () => {
  const added = addIncome(fresh(), {
    title: "درآمد",
    source: "منبع",
    amount: 10000,
    currency: "TMN",
  });
  assert.throws(
    () => deleteRecord(added, "vault", added.vaultEntries[0].id),
    /مرتبط/,
  );
});
test("Legacy records permit metadata changes but never guess financial provenance", () => {
  const before = fresh();
  const t = before.transactions.find((t) => t.id === "t1")!;
  assert.throws(() => deleteRecord(before, "transaction", t.id), /تاریخی/);
  const edited = editTransaction(before, t.id, {
    title: "توضیح جدید",
    amount: t.amount,
    source: t.source,
    category: t.category,
  });
  assert.deepEqual(edited.funds, before.funds);
  assert.equal(
    edited.transactions.find((t) => t.id === "t1")!.title,
    "توضیح جدید",
  );
  assert.throws(() => deleteRecord(before, "vault", "v1"), /قدیمی/);
});
test("Business removal keeps ledger, fund deletion rejects referenced or funded pools", () => {
  const before = fresh();
  const removed = deleteRecord(before, "business", "studio");
  assert.equal(removed.transactions.length, before.transactions.length);
  assert.ok(removed.transactions.every((t) => t.businessId !== "studio"));
  assert.throws(() => deleteRecord(before, "fund", "daily"));
  assert.throws(() => deleteRecord(before, "fund", "treasury"));
  before.funds.push({
    id: "empty",
    title: "خالی",
    balance: 0,
    percent: 0,
    color: "#ffffff",
  });
  assert.ok(
    !deleteRecord(before, "fund", "empty").funds.some((f) => f.id === "empty"),
  );
});
test("Backup rejects malformed allocations, duplicate IDs and dangling ledger links", () => {
  const good = addIncome(fresh(), {
    title: "درآمد",
    source: "منبع",
    amount: 10000,
    currency: "TMN",
  });
  assert.ok(validateBackup(good));
  const negative = structuredClone(good);
  negative.transactions[0].allocations![0].amount = -1;
  const missing = structuredClone(good);
  missing.vaultEntries[0].transactionId = "unknown";
  const duplicate = structuredClone(good);
  duplicate.transactions.push(duplicate.transactions[0]);
  const wrongTotal = structuredClone(good);
  wrongTotal.transactions[0].allocations![0].amount += 100;
  for (const invalid of [negative, missing, duplicate, wrongTotal])
    assert.equal(validateBackup(invalid), false);
});
