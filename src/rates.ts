import type { Rates } from "./types";
export const rateSources = {
  nerkhara: "https://nerkhara.com/api/v1/latest.json",
  "iran-market":
    "https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json",
};
const keys = ["gold", "usd", "emami", "bahar"] as const;
const ids = {
  nerkhara: ["gold-18k", "usd", "coin-emami", "coin-bahar-azadi"],
  "iran-market": [
    "GOLD_18K_IRR",
    "USD_IRR_FREE",
    "COIN_EMAMI_IRR",
    "COIN_BAHAR_IRR",
  ],
};
export const isStale = (rates: Rates, now = Date.now()) =>
  rates.source === "unset" || now - Date.parse(rates.updatedAt) > 30 * 60_000;
function utc(value: unknown) {
  if (typeof value !== "string") throw new Error("زمان نرخ معتبر نیست.");
  const time = Date.parse(
    /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`,
  );
  if (!Number.isFinite(time)) throw new Error("زمان نرخ معتبر نیست.");
  return time;
}
export function parseRates(
  payload: unknown,
  source: keyof typeof rateSources,
  now = Date.now(),
): Rates {
  if (!payload || typeof payload !== "object")
    throw new Error("پاسخ منبع معتبر نیست.");
  const root = payload as Record<string, unknown>;
  const data = root.data as
    { categories?: Record<string, unknown[]> } | undefined;
  const items =
    source === "nerkhara"
      ? root.items
      : data?.categories && Object.values(data.categories).flat();
  if (!Array.isArray(items)) throw new Error("ساختار نرخ تغییر کرده است.");
  const times: number[] = [];
  const values = keys.map((key, index) => {
    const row = items.find(
      (item) =>
        item &&
        typeof item === "object" &&
        (source === "nerkhara" ? item.id : item.symbol) === ids[source][index],
    );
    if (
      !row ||
      (source === "nerkhara" ? row.unit : row.currency) !== "IRT" ||
      typeof row.price !== "number" ||
      !Number.isFinite(row.price) ||
      row.price <= 0 ||
      row.stale === true
    )
      throw new Error(`نرخ ${key} معتبر یا تازه نیست.`);
    const time = utc(source === "nerkhara" ? row.updated_utc : row.timestamp);
    if (time > now + 5 * 60_000 || now - time > 30 * 60_000)
      throw new Error("منبع، نرخ تازه ارائه نکرده است.");
    times.push(time);
    return row.price;
  });
  return {
    gold: values[0],
    usd: values[1],
    emami: values[2],
    bahar: values[3],
    updatedAt: new Date(Math.min(...times)).toISOString(),
    source,
  };
}
export async function fetchRates(
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Rates> {
  for (const source of Object.keys(
    rateSources,
  ) as (keyof typeof rateSources)[]) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
      const response = await fetcher(rateSources[source], {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("دریافت نرخ ناموفق بود.");
      return parseRates(await response.json(), source);
    } catch {
      signal?.throwIfAborted();
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  throw new Error(
    "دسترسی به منابع نرخ ممکن نشد؛ آخرین نرخ حفظ شد. می‌توانید نرخ را دستی ثبت کنید.",
  );
}
