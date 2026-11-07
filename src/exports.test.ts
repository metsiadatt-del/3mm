import test from "node:test";
import assert from "node:assert/strict";
import { createCsvReport, reportTransactions } from "./exports";
import { seed } from "./test-fixtures";
test("Report filtering uses complete calendar days and preserves historical rates", () => {
  const dates = seed.transactions.map((t) => t.date.slice(0, 10)).sort();
  const start = new Date(`${dates[0]}T00:00:00`);
  start.setDate(start.getDate() - 1);
  const end = new Date(`${dates.at(-1)}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const rows = reportTransactions(
    seed.transactions,
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
    "all",
  );
  assert.equal(rows.length, seed.transactions.length);
  assert.ok(
    rows.every((row, index) => index === 0 || row.date <= rows[index - 1].date),
  );
  assert.match(
    createCsvReport([{ ...seed.transactions[0], title: "=unsafe formula" }]),
    /'=unsafe formula/,
  );
  assert.match(createCsvReport(seed.transactions), /نرخ تاریخی طلا/);
});
test("Report filters exclude transactions outside the end date", () => {
  const rows = reportTransactions(
    seed.transactions,
    "2099-01-01",
    "2099-12-31",
    "income",
  );
  assert.equal(rows.length, 0);
});
