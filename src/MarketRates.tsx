import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Gem,
  CircleDollarSign,
  Coins,
  Settings2,
} from "lucide-react";
import { useFinance } from "./store";
import { money } from "./finance";
import { fetchRates, isStale } from "./rates";
export function MarketRates({ edit }: { edit: () => void }) {
  const { data, ready, update } = useFinance();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current || !useFinance.getState().ready) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    const previous = useFinance.getState().data.rates;
    try {
      const rates = await fetchRates(controller.signal);
      if (useFinance.getState().data.rates === previous)
        update((d) => ({ ...d, rates }));
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "دریافت نرخ انجام نشد.");
    } finally {
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
        setClock(Date.now());
      }
    }
  }, [update]);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      setClock(Date.now());
      if (document.visibilityState !== "hidden" && navigator.onLine)
        void refresh();
    };
    check();
    const interval = setInterval(check, 5 * 60_000);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
      active.current?.abort();
      active.current = null;
    };
  }, [ready, refresh]);
  const rates = data.rates;
  const label =
    rates.source === "unset"
      ? "در انتظار نرخ"
      : rates.source === "manual"
        ? "ورودی دستی"
        : isStale(rates, clock)
          ? "نرخ قدیمی"
          : "نرخ آنلاین";
  return (
    <section
      className="market-container"
      aria-label="نرخ‌های بازار"
      aria-busy={loading}
    >
      <div
        className={`market-strip ${loading && rates.source === "unset" ? "rates-loading" : ""}`}
      >
        <div className="market-status">
          <span className="pulse-dot" />
          <span>دیدبان بازار</span>
          <span className="market-demo">{label}</span>
        </div>
        {(
          [
            { key: "gold", title: "طلای ۱۸ عیار", icon: Gem },
            { key: "usd", title: "دلار آمریکا", icon: CircleDollarSign },
            { key: "emami", title: "سکه امامی", icon: Coins },
            { key: "bahar", title: "سکه بهار آزادی", icon: Coins },
          ] as const
        ).map((r) => (
          <button key={r.key} onClick={edit}>
            <r.icon size={17} />
            <span>{r.title}</span>
            <bdi>{rates[r.key] > 0 ? money(rates[r.key]) : "—"}</bdi>
            <small>تومان</small>
          </button>
        ))}
        <button
          className="market-refresh"
          onClick={() => void refresh()}
          disabled={!ready || loading}
          aria-label="به‌روزرسانی نرخ‌های بازار"
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {loading ? "دریافت…" : "به‌روزرسانی"}
        </button>
        <button onClick={edit} aria-label="ثبت دستی نرخ‌های بازار">
          <Settings2 size={17} />
        </button>
      </div>
      <div className="rate-details" aria-live="polite">
        <span>
          {rates.source === "unset" ? (
            "برای ثبت تراکنش، نرخ آنلاین دریافت یا نرخ دستی وارد کنید."
          ) : (
            <>
              آخرین نرخ: {new Date(rates.updatedAt).toLocaleString("fa-IR")} ·{" "}
              {rates.source === "manual" ? (
                "ثبت‌شده توسط شما"
              ) : (
                <a
                  href={
                    rates.source === "nerkhara"
                      ? "https://nerkhara.com/en/api/"
                      : "https://iran-market.github.io/"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {rates.source === "nerkhara" ? "NerkhAra" : "Iran Market"}
                </a>
              )}
            </>
          )}
        </span>
        {error && (
          <span role="status" className="negative">
            {error}
          </span>
        )}
        {!error && isStale(rates, clock) && rates.source !== "unset" && (
          <span>نرخ قدیمی است؛ برای تصمیم مالی به‌روزرسانی کنید.</span>
        )}
      </div>
    </section>
  );
}
