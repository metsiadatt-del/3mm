import test from "node:test";
import assert from "node:assert/strict";
import { fetchRates, isStale, parseRates, rateSources } from "./rates";
const now = Date.now();
const timestamp = new Date(now).toISOString();
function primary() {
  return {
    items: ["gold-18k", "usd", "coin-emami", "coin-bahar-azadi"].map(
      (id, i) => ({
        id,
        unit: "IRT",
        price: (i + 1) * 100000,
        updated_utc: timestamp.replace("Z", ""),
        stale: false,
      }),
    ),
  };
}
function backup() {
  return {
    data: {
      categories: {
        currency: [
          "GOLD_18K_IRR",
          "USD_IRR_FREE",
          "COIN_EMAMI_IRR",
          "COIN_BAHAR_IRR",
        ].map((symbol, i) => ({
          symbol,
          currency: "IRT",
          price: (i + 1) * 200000,
          timestamp,
          stale: false,
        })),
      },
    },
  };
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
test("Primary parser normalizes UTC without timezone and maps all four instruments", () => {
  const rates = parseRates(primary(), "nerkhara", now);
  assert.deepEqual(
    [rates.gold, rates.usd, rates.emami, rates.bahar],
    [100000, 200000, 300000, 400000],
  );
  assert.equal(rates.updatedAt, timestamp);
  assert.equal(rates.source, "nerkhara");
});
test("Backup parser reads nested categories and uses exact coin symbol, not bubble price", () => {
  const payload = backup();
  payload.data.categories.currency.unshift({
    symbol: "COIN_BAHAR_BUBBLE_IRR",
    currency: "IRT",
    price: 1,
    timestamp,
    stale: false,
  });
  assert.equal(parseRates(payload, "iran-market", now).bahar, 800000);
});
test("Reject malformed, incomplete, wrong-unit, stale, future and nonpositive rates", () => {
  for (const invalid of [null, {}, { items: [] }])
    assert.throws(() => parseRates(invalid, "nerkhara", now));
  for (const change of [
    { unit: "IRR" },
    { price: 0 },
    { price: -1 },
    { price: Infinity },
    { stale: true },
    { updated_utc: "bad" },
    { updated_utc: new Date(now - 31 * 60000).toISOString() },
    { updated_utc: new Date(now + 6 * 60000).toISOString() },
  ]) {
    const payload = primary();
    Object.assign(payload.items[0], change);
    assert.throws(() => parseRates(payload, "nerkhara", now));
  }
});
test("Rate timestamp is the oldest required instrument, not fetch time", () => {
  const payload = primary();
  const oldest = new Date(now - 10 * 60000).toISOString();
  payload.items[1].updated_utc = oldest;
  const rates = parseRates(payload, "nerkhara", now);
  assert.equal(rates.updatedAt, oldest);
  assert.equal(isStale(rates, now), false);
  assert.equal(isStale(rates, now + 31 * 60000), true);
});
test("Uses primary and does not call fallback after success", async () => {
  const calls: unknown[] = [];
  const fetcher: typeof fetch = async (url) => {
    calls.push(url);
    return response(primary());
  };
  assert.equal((await fetchRates(undefined, fetcher)).source, "nerkhara");
  assert.deepEqual(calls, [rateSources.nerkhara]);
});
test("Network failure, HTTP failure and invalid primary data each fall back independently", async () => {
  for (const failure of ["network", "http", "schema"]) {
    const calls: unknown[] = [];
    const fetcher: typeof fetch = async (url) => {
      calls.push(url);
      if (url === rateSources.nerkhara) {
        if (failure === "network") throw new TypeError("network");
        return failure === "http" ? response({}, 503) : response({});
      }
      return response(backup());
    };
    assert.equal((await fetchRates(undefined, fetcher)).source, "iran-market");
    assert.equal(calls.length, 2);
  }
});
test("Both-source failure reports manual fallback rather than inventing a rate", async () => {
  await assert.rejects(
    fetchRates(undefined, async () => response({}, 503)),
    /دستی/,
  );
});
test("Caller abort stops the request without starting fallback", async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    controller.abort();
    init?.signal?.throwIfAborted();
    return response(primary());
  };
  await assert.rejects(fetchRates(controller.signal, fetcher), {
    name: "AbortError",
  });
  assert.equal(calls, 1);
});
test("Request timeout aborts primary then falls back", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    if (calls === 2) return response(backup());
    return new Promise((_resolve, reject) =>
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("timeout", "AbortError")),
        { once: true },
      ),
    );
  };
  const result = fetchRates(undefined, fetcher);
  context.mock.timers.tick(8001);
  assert.equal((await result).source, "iran-market");
  assert.equal(calls, 2);
});
