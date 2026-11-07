import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  X,
  ArrowLeftRight,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Printer,
  Upload,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useFinance } from "./store";
import JalaliDateField from "./DateField";
import {
  addExpense,
  addIncome,
  allocate,
  compact,
  convertAsset,
  fa,
  jalali,
  money,
  parseNumber,
  recordVault,
  toToman,
  validateBackup,
} from "./finance";
import { Transactions, Money } from "./components";
import {
  createCsvReport,
  createExcelReport,
  reportTransactions,
} from "./exports";
import {
  deleteRecord,
  editTransaction,
  editVault,
  type Entity,
} from "./records";
import type { Asset, Business, Currency, Fund, Note } from "./types";
export type ModalState = {
  type:
    | "transaction"
    | "delete"
    | "fund"
    | "income"
    | "expense"
    | "business"
    | "asset"
    | "convert"
    | "vault"
    | "note"
    | "rates"
    | "budget"
    | "report"
    | "settings"
    | "install";
  id?: string;
} | null;
const titles = {
  transaction: "ویرایش تراکنش",
  delete: "تأیید حذف رکورد",
  fund: "ویرایش صندوق",
  income: "ثبت درآمد جدید",
  expense: "ثبت هزینه جدید",
  business: "پروفایل کسب‌وکار",
  asset: "ثبت و ارزش‌گذاری دارایی",
  convert: "تبدیل دارایی",
  vault: "تراکنش خزانه",
  note: "یادداشت مالی",
  rates: "نرخ‌های بازار",
  budget: "آنزیم بودجه‌بندی BOP",
  report: "گزارش مالی",
  settings: "تنظیمات و پشتیبان‌گیری",
  install: "متافایننس همیشه همراه شما",
};
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  modal,
  close,
  notify,
}: {
  modal: NonNullable<ModalState>;
  close: () => void;
  notify: (text: string) => void;
}) {
  const { data, update } = useFinance();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [budgetFunds, setBudgetFunds] = useState(data.funds);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(
      () =>
        ref.current
          ?.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled])',
          )
          ?.focus(),
      30,
    );
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const all = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href]',
          ) ?? [],
        );
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [close]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const n = (k: string) => parseNumber(s(k));
    try {
      if (modal.type === "delete") {
        const separator = modal.id!.indexOf(":");
        update((d) =>
          deleteRecord(
            d,
            modal.id!.slice(0, separator) as Entity,
            modal.id!.slice(separator + 1),
          ),
        );
      }
      if (modal.type === "transaction")
        update((d) =>
          editTransaction(d, modal.id!, {
            title: s("title"),
            amount: n("amount"),
            source: s("source"),
            category: s("category"),
            fundId: s("fund") || undefined,
          }),
        );
      if (modal.type === "fund") {
        if (!s("title")) throw new Error("نام صندوق الزامی است.");
        update((d) => ({
          ...d,
          funds: d.funds.map((fund) =>
            fund.id === modal.id ? { ...fund, title: s("title") } : fund,
          ),
        }));
      }
      if (modal.type === "income")
        update((d) =>
          addIncome(d, {
            title: s("title"),
            amount: n("amount"),
            currency: s("currency") as Currency,
            source:
              s("source") === "custom"
                ? s("customSource")
                : (d.businesses.find((b) => b.id === s("source"))?.title ??
                  s("source")),
            businessId: s("source") === "custom" ? undefined : s("source"),
            treasuryCurrency: s("treasuryCurrency") as "GOLD" | "USD",
          }),
        );
      if (modal.type === "expense")
        update((d) =>
          addExpense(d, {
            title: s("title"),
            amount: toToman(n("amount"), s("currency") as Currency, d.rates),
            fundId: s("fund"),
            category: s("category"),
            businessId: s("business") || undefined,
          }),
        );
      if (modal.type === "business") {
        const business: Business = {
          id: modal.id ?? crypto.randomUUID(),
          title: s("title"),
          description: s("description"),
          initialCapital: n("initial"),
          workingCapital: n("working"),
          reserveGold: n("reserve"),
          startDate: new Date(s("date")).toISOString(),
          color:
            data.businesses.find((b) => b.id === modal.id)?.color ?? "#91a7cb",
        };
        if (
          [
            business.initialCapital,
            business.workingCapital,
            business.reserveGold,
          ].some((v) => !Number.isFinite(v) || v < 0)
        )
          throw new Error("مقادیر سرمایه باید صفر یا بیشتر باشند.");
        update((d) => ({
          ...d,
          businesses: modal.id
            ? d.businesses.map((b) => (b.id === modal.id ? business : b))
            : [...d.businesses, business],
        }));
      }
      if (modal.type === "asset") {
        const oldAsset = data.assets.find((a) => a.id === modal.id);
        const asset: Asset = {
          id: modal.id ?? crypto.randomUUID(),
          title: s("title"),
          category: s("category"),
          purchasePrice: n("purchase"),
          value: n("value"),
          purchaseGold: n("purchase") / n("historic"),
          purchasedAt: new Date(s("date")).toISOString(),
          status: oldAsset?.status ?? "active",
          realizedGain:
            oldAsset?.realizedGain === undefined
              ? undefined
              : oldAsset.realizedGain + oldAsset.purchasePrice - n("purchase"),
        };
        if (
          ![asset.purchasePrice, asset.value, asset.purchaseGold].every(
            (v) => Number.isFinite(v) && v >= 0,
          ) ||
          n("historic") <= 0
        )
          throw new Error("ارزش دارایی و نرخ تاریخی را بررسی کنید.");
        update((d) => ({
          ...d,
          assets: modal.id
            ? d.assets.map((a) => (a.id === modal.id ? asset : a))
            : [asset, ...d.assets],
        }));
      }
      if (modal.type === "convert")
        update((d) =>
          convertAsset(d, {
            assetId: modal.id!,
            amount: n("amount"),
            fundId: s("fund"),
          }),
        );
      if (modal.type === "vault")
        update((d) => {
          const input = {
            currency: s("currency") as "GOLD" | "USD",
            direction: s("direction") as "deposit" | "withdraw",
            quantity: n("quantity"),
            fundId: s("fund"),
            source: s("source"),
            reason: s("reason"),
            memo: s("memo"),
          };
          return d.vaultEntries.some((v) => v.id === modal.id)
            ? editVault(d, modal.id!, input)
            : recordVault(d, input);
        });
      if (modal.type === "note") {
        const note: Note = {
          id: modal.id ?? crypto.randomUUID(),
          title: s("title"),
          body: s("body"),
          tag: s("tag"),
          pinned: f.get("pinned") === "on",
          date: new Date().toISOString(),
        };
        update((d) => ({
          ...d,
          notes: modal.id
            ? d.notes.map((a) => (a.id === modal.id ? note : a))
            : [note, ...d.notes],
        }));
      }
      if (modal.type === "rates") {
        if (
          ["gold", "usd", "emami", "bahar"].some(
            (k) => !Number.isFinite(n(k)) || n(k) <= 0,
          )
        )
          throw new Error("همه نرخ‌ها باید مثبت باشند.");
        update((d) => ({
          ...d,
          rates: {
            gold: n("gold"),
            usd: n("usd"),
            emami: n("emami"),
            bahar: n("bahar"),
            source: "manual",
            updatedAt: new Date().toISOString(),
          },
        }));
      }
      if (modal.type === "budget") {
        const funds = budgetFunds.map((a) => ({ ...a, percent: n(a.id) }));
        if (
          funds.some(
            (a) =>
              !Number.isFinite(a.percent) || a.percent < 0 || a.percent > 100,
          )
        )
          throw new Error("درصدها باید بین صفر تا ۱۰۰ باشند.");
        allocate(100, funds);
        update((d) => ({ ...d, funds }));
      }
      notify(
        modal.type === "delete"
          ? "رکورد حذف شد؛ وضعیت ذخیره دستگاه را بررسی کنید."
          : "با موفقیت ثبت شد.",
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت اطلاعات انجام نشد.");
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${modal.type === "report" ? "report-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">
              METAFINANCE / {modal.type.toUpperCase()}
            </span>
            <h2 id="modal-title">{titles[modal.type]}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="بستن پنجره"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {modal.type === "report" ? (
          <Report notify={notify} />
        ) : modal.type === "settings" ? (
          <Settings notify={notify} error={setError} />
        ) : modal.type === "install" ? (
          <div className="install-guide">
            <div className="install-logo">MET</div>
            <h3>یک قدم تا دسترسی سریع‌تر</h3>
            <p>
              در آیفون، این صفحه را در Safari باز کنید، دکمه اشتراک‌گذاری را
              بزنید و «Add to Home Screen» را انتخاب کنید.
            </p>
            <p>
              در اندروید یا دسکتاپ، از منوی مرورگر گزینه «نصب برنامه» را انتخاب
              کنید.
            </p>
            <div className="info-box">
              <ShieldCheck size={20} />
              بعد از اولین بارگذاری آنلاین، نسخه نصب‌شده به‌صورت آفلاین هم کار
              می‌کند.
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="modal-form">
            <FormBody
              modal={modal}
              budgetFunds={budgetFunds}
              setBudgetFunds={setBudgetFunds}
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <footer className="modal-footer">
              <button className="primary" type="submit">
                <Check size={17} />
                {modal.type === "delete"
                  ? "تأیید حذف"
                  : modal.type === "income"
                    ? "ثبت و تخصیص خودکار"
                    : modal.type === "convert"
                      ? "تأیید فروش و انتقال"
                      : "ذخیره تغییرات"}
              </button>
              <button type="button" className="secondary" onClick={close}>
                انصراف
              </button>
            </footer>
          </form>
        )}
        {(modal.type === "settings" || modal.type === "report") && error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
function FormBody({
  modal,
  budgetFunds,
  setBudgetFunds,
}: {
  modal: NonNullable<ModalState>;
  budgetFunds: Fund[];
  setBudgetFunds: Dispatch<SetStateAction<Fund[]>>;
}) {
  const { data } = useFinance();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("TMN");
  const [source, setSource] = useState(data.businesses[0]?.id ?? "custom");
  const entry = data.vaultEntries.find((v) => v.id === modal.id);
  const [direction, setDirection] = useState(entry?.direction ?? "deposit");
  const [vaultCurrency, setVaultCurrency] = useState(
    entry?.currency ?? (modal.id === "USD" ? "USD" : "GOLD"),
  );
  const [customTitle, setCustomTitle] = useState("");
  const value = toToman(parseNumber(amount) || 0, currency, data.rates);
  const today = new Date().toISOString().slice(0, 10);
  if (modal.type === "delete") {
    const split = modal.id!.indexOf(":");
    const entity = modal.id!.slice(0, split);
    const id = modal.id!.slice(split + 1);
    const rows =
      entity === "transaction"
        ? data.transactions
        : entity === "vault"
          ? data.vaultEntries
          : entity === "asset"
            ? data.assets
            : entity === "business"
              ? data.businesses
              : entity === "fund"
                ? data.funds
                : data.notes;
    const record = rows.find((row) => row.id === id);
    return (
      <div className="delete-confirmation">
        <h3>این رکورد حذف شود؟</h3>
        <strong>
          {record && ("title" in record ? record.title : record.reason)}
        </strong>
        <p>
          حذف دائمی است. اثر مالی تراکنش از صندوق و خزانه برگردانده می‌شود؛ اگر
          موجودی مصرف شده باشد، حذف انجام نخواهد شد. حذف کسب‌وکار، تاریخچه مالی
          آن را پاک نمی‌کند.
        </p>
      </div>
    );
  }
  if (modal.type === "fund")
    return (
      <>
        <Field label="نام صندوق">
          <input
            name="title"
            required
            defaultValue={data.funds.find((f) => f.id === modal.id)?.title}
          />
        </Field>
        <p className="helper">
          درصد تخصیص را از فرم بودجه‌بندی تنظیم کنید. حذف صندوق تنها پس از
          صفرکردن سهم و موجودی و در نبود سابقه مالی ممکن است.
        </p>
      </>
    );
  if (modal.type === "transaction") {
    const t = data.transactions.find((t) => t.id === modal.id)!;
    return (
      <>
        <div className="info-box">
          تاریخ و نرخ تاریخی حفظ می‌شوند. اصلاح مبلغ با بازگرداندن اثر قبلی و
          ثبت اثر جدید به‌صورت یکپارچه انجام می‌شود.
        </div>
        <Field label="عنوان">
          <input name="title" required defaultValue={t.title} />
        </Field>
        <Field label="مبلغ · تومان">
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={t.amount}
          />
        </Field>
        <Field label="منبع">
          <input name="source" required defaultValue={t.source} />
        </Field>
        <Field label="دسته‌بندی">
          <input name="category" required defaultValue={t.category} />
        </Field>
        {t.kind !== "income" && (
          <Field label="صندوق">
            <select name="fund" defaultValue={t.fundId}>
              {data.funds
                .filter((f) => f.id !== "treasury")
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </>
    );
  }
  if (modal.type === "income" || modal.type === "expense")
    return (
      <>
        <div className="info-box">
          <span className="status-dot" /> {jalali(new Date(), true)}
          <span className="spacer" />
          <span>ثبت خودکار زمان و نرخ</span>
        </div>
        <Field label="عنوان تراکنش">
          <input
            name="title"
            required
            placeholder={
              modal.type === "income"
                ? "مثلاً درآمد پروژه طراحی وب‌سایت"
                : "مثلاً اجاره دفتر کار"
            }
            autoComplete="off"
          />
        </Field>
        <div className="form-grid">
          <Field label="مبلغ">
            <input
              name="amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="۰"
            />
          </Field>
          <Field label="واحد ورود">
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              <option value="TMN">تومان</option>
              <option value="GOLD">گرم طلای ۱۸ عیار</option>
              <option value="USD">دلار آمریکا</option>
            </select>
          </Field>
        </div>
        <div className="conversion-preview">
          <ArrowLeftRight size={17} />
          <span>{money(value)} تومان</span>
          <span>{fa(value / data.rates.gold, 3)} گرم طلا</span>
          <span dir="auto">{fa(value / data.rates.usd, 2)} USD</span>
        </div>
        {modal.type === "income" ? (
          <>
            <Field label="منبع درآمد">
              <select
                name="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {data.businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
                <option value="custom">منبع دیگر</option>
              </select>
            </Field>
            {source === "custom" && (
              <Field label="نام منبع">
                <input
                  name="customSource"
                  required
                  placeholder="نام منبع درآمد"
                />
              </Field>
            )}
            <h3 className="form-section-title">این درآمد چطور تقسیم می‌شود؟</h3>
            <div className="bop-preview">
              {data.funds.map((f) => (
                <div key={f.id}>
                  <i style={{ background: f.color }} />
                  <span>{f.title}</span>
                  <b>{fa(f.percent)}٪</b>
                  <small>{compact((value * f.percent) / 100)} تومان</small>
                </div>
              ))}
            </div>
            <Field label="سهم خزانه به چه ذخیره‌ای تبدیل شود؟">
              <select name="treasuryCurrency">
                <option value="GOLD">طلای ۱۸ عیار</option>
                <option value="USD">دلار آمریکا</option>
              </select>
            </Field>
            <p className="helper">
              سهم خزانه به ذخیره انتخابی تبدیل و بقیه سهم‌ها به موجودی صندوق‌ها
              اضافه می‌شود.
            </p>
          </>
        ) : (
          <>
            <Field
              label="صندوق پرداخت"
              hint="برداشت فقط تا سقف موجودی صندوق امکان‌پذیر است."
            >
              <select name="fund" required>
                {data.funds
                  .filter((f) => f.id !== "treasury")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} · {compact(f.balance)} تومان
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="دسته‌بندی">
                <select name="category">
                  {[
                    "زندگی",
                    "مسکن و دفتر",
                    "خوراک",
                    "رفت‌وآمد",
                    "تجهیزات",
                    "آموزش",
                    "سلامت",
                    "بدهی",
                    "سایر",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="کسب‌وکار مرتبط">
                <select name="business">
                  <option value="">شخصی / عمومی</option>
                  {data.businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        )}
      </>
    );
  if (modal.type === "business") {
    const b = data.businesses.find((b) => b.id === modal.id);
    return (
      <>
        <Field label="نام کسب‌وکار">
          <input name="title" defaultValue={b?.title} required />
        </Field>
        <Field label="درباره کسب‌وکار">
          <textarea name="description" rows={3} defaultValue={b?.description} />
        </Field>
        <JalaliDateField
          label="تاریخ شروع · شمسی"
          name="date"
          defaultValue={b?.startDate.slice(0, 10) ?? today}
        />
        <div className="form-grid">
          <Field label="سرمایه اولیه · تومان">
            <input
              name="initial"
              inputMode="decimal"
              defaultValue={b?.initialCapital ?? 0}
              required
            />
          </Field>
          <Field label="سرمایه در گردش · تومان">
            <input
              name="working"
              inputMode="decimal"
              defaultValue={b?.workingCapital ?? 0}
              required
            />
          </Field>
        </div>
        <Field
          label="هدف صندوق اطمینان و توسعه · گرم طلا"
          hint="هدف ذخیره کسب‌وکار است و جداگانه به دارایی خالص اضافه نمی‌شود."
        >
          <input
            name="reserve"
            inputMode="decimal"
            defaultValue={b?.reserveGold ?? 0}
            required
          />
        </Field>
      </>
    );
  }
  if (modal.type === "asset") {
    const a = data.assets.find((a) => a.id === modal.id);
    return (
      <>
        <div className="info-box">
          ثبت دارایی موجود؛ برای خرید جدید ابتدا هزینه را از صندوق مرتبط ثبت
          کنید.
        </div>
        <Field label="عنوان دارایی">
          <input name="title" required defaultValue={a?.title} />
        </Field>
        <div className="form-grid">
          <Field label="دسته‌بندی">
            <select name="category" defaultValue={a?.category}>
              {[
                "املاک",
                "خودرو",
                "بورس",
                "طلا",
                "رمزارز",
                "تجهیزات",
                "سایر",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <JalaliDateField
            label="تاریخ خرید · شمسی"
            name="date"
            defaultValue={a?.purchasedAt.slice(0, 10) ?? today}
          />
        </div>
        <div className="form-grid">
          <Field label="قیمت خرید · تومان">
            <input
              name="purchase"
              defaultValue={a?.purchasePrice}
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="ارزش امروز · تومان">
            <input
              name="value"
              defaultValue={a?.value}
              inputMode="decimal"
              required
            />
          </Field>
        </div>
        <Field label="نرخ هر گرم طلا در تاریخ خرید · تومان">
          <input
            name="historic"
            defaultValue={
              a && a.purchaseGold > 0
                ? a.purchasePrice / a.purchaseGold
                : data.rates.gold || ""
            }
            required
            inputMode="decimal"
          />
        </Field>
      </>
    );
  }
  if (modal.type === "convert") {
    const a = data.assets.find((a) => a.id === modal.id);
    return (
      <>
        <div className="info-box">
          {a?.title} · بهای خرید: {compact(a?.purchasePrice ?? 0)} تومان
        </div>
        <Field label="مبلغ فروش واقعی · تومان">
          <input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={a?.value}
          />
        </Field>
        <Field label="صندوق مقصد">
          <select name="fund">
            {data.funds
              .filter((f) => f.id !== "treasury")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
          </select>
        </Field>
        <p className="helper">
          پس از تأیید، دارایی فروخته‌شده بایگانی و وجه آن به صندوق مقصد منتقل
          می‌شود. سود یا زیان محقق‌شده ثبت خواهد شد.
        </p>
      </>
    );
  }
  if (modal.type === "vault") {
    return (
      <>
        {entry && !entry.fundId && (
          <div className="info-box">
            برای رکورد قدیمی فقط منبع، دلیل و یادداشت را تغییر دهید؛ اطلاعات
            صندوق تاریخی موجود نیست.
          </div>
        )}
        <div className="form-grid">
          <Field label="نوع ذخیره">
            <select
              name="currency"
              value={vaultCurrency}
              onChange={(e) =>
                setVaultCurrency(e.target.value as "GOLD" | "USD")
              }
            >
              <option value="GOLD">طلای ۱۸ عیار</option>
              <option value="USD">دلار آمریکا</option>
            </select>
          </Field>
          <Field label="نوع تراکنش">
            <select
              name="direction"
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as "deposit" | "withdraw")
              }
            >
              <option value="deposit">واریز به خزانه</option>
              <option value="withdraw">برداشت از خزانه</option>
            </select>
          </Field>
        </div>
        <Field label={`مقدار · ${vaultCurrency === "GOLD" ? "گرم" : "دلار"}`}>
          <input
            name="quantity"
            required
            inputMode="decimal"
            defaultValue={entry?.quantity}
          />
        </Field>
        <Field label={direction === "deposit" ? "صندوق مبدأ" : "صندوق مقصد"}>
          <select name="fund" defaultValue={entry?.fundId}>
            {direction === "deposit" && (
              <option value="external">
                دارایی خارج از برنامه (افزایش دارایی خالص)
              </option>
            )}
            {data.funds
              .filter((f) => f.id !== "treasury")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} · {compact(f.balance)} تومان
                </option>
              ))}
          </select>
        </Field>
        <Field label="منبع / طرف حساب">
          <input name="source" required defaultValue={entry?.source} />
        </Field>
        <Field label="دلیل تراکنش">
          <input name="reason" required defaultValue={entry?.reason} />
        </Field>
        <Field label="یادداشت">
          <textarea name="memo" rows={2} defaultValue={entry?.memo} />
        </Field>
      </>
    );
  }
  if (modal.type === "note") {
    const n = data.notes.find((a) => a.id === modal.id);
    return (
      <>
        <Field label="عنوان">
          <input name="title" defaultValue={n?.title} required />
        </Field>
        <Field label="متن یادداشت">
          <textarea name="body" defaultValue={n?.body} rows={6} required />
        </Field>
        <Field label="برچسب">
          <input name="tag" defaultValue={n?.tag ?? "یادداشت شخصی"} required />
        </Field>
        <label className="check-field">
          <input type="checkbox" name="pinned" defaultChecked={n?.pinned} />
          سنجاق کردن یادداشت
        </label>
      </>
    );
  }
  if (modal.type === "rates")
    return (
      <>
        <div className="info-box">
          نرخ آنلاین از دیدبان بازار دریافت می‌شود. این فرم برای ثبت دستی هنگام
          قطعی منابع است؛ نرخ تاریخی تراکنش‌ها تغییر نمی‌کند.
        </div>
        {(
          [
            { key: "gold", title: "هر گرم طلای ۱۸ عیار" },
            { key: "usd", title: "دلار آمریکا" },
            { key: "emami", title: "سکه امامی" },
            { key: "bahar", title: "سکه بهار آزادی" },
          ] as const
        ).map((r) => (
          <Field key={r.key} label={`${r.title} · تومان`}>
            <input
              name={r.key}
              inputMode="decimal"
              required
              defaultValue={data.rates[r.key]}
            />
          </Field>
        ))}
        <p className="helper">
          {data.rates.source === "unset" ? (
            "هنوز نرخی ثبت نشده است."
          ) : (
            <>
              آخرین ویرایش: {jalali(data.rates.updatedAt)} ·{" "}
              {new Date(data.rates.updatedAt).toLocaleTimeString("fa-IR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          )}
        </p>
      </>
    );
  if (modal.type === "budget")
    return (
      <>
        <p className="helper">
          اولویت‌ها را یک بار تنظیم کنید؛ هر درآمد جدید به‌صورت خودکار بین
          صندوق‌ها تقسیم می‌شود.
        </p>
        {budgetFunds.map((f, i) => (
          <div key={f.id} className="budget-row">
            <span>
              <i style={{ background: f.color }} />
              {f.title}
            </span>
            <input
              aria-label={`درصد ${f.title}`}
              name={f.id}
              inputMode="decimal"
              defaultValue={f.percent}
              onChange={(e) =>
                setBudgetFunds((p) =>
                  p.map((fund, j) =>
                    i === j
                      ? { ...fund, percent: parseNumber(e.target.value) }
                      : fund,
                  ),
                )
              }
              required
            />
            <b>٪</b>
          </div>
        ))}
        <div
          className={`budget-total ${Math.abs(budgetFunds.reduce((s, f) => s + f.percent, 0) - 100) < 0.001 ? "positive" : "negative"}`}
        >
          مجموع تخصیص{" "}
          <b>
            {fa(
              budgetFunds.reduce((s, f) => s + f.percent, 0),
              2,
            )}
            ٪ / ۱۰۰٪
          </b>
        </div>
        <div className="add-fund">
          <input
            aria-label="نام صندوق جدید"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="نام صندوق شخصی جدید"
          />
          <button
            type="button"
            className="secondary"
            disabled={!customTitle.trim()}
            onClick={() => {
              setBudgetFunds((funds) => [
                ...funds,
                {
                  id: crypto.randomUUID(),
                  title: customTitle.trim(),
                  balance: 0,
                  percent: 0,
                  color: "#b0b6c8",
                },
              ]);
              setCustomTitle("");
            }}
          >
            <Plus size={17} />
            صندوق
          </button>
        </div>
        <p className="helper">
          صندوق جدید با ذخیره فرم ثبت می‌شود؛ انصراف هیچ تغییری در صندوق‌ها
          نمی‌دهد. مجموع درصدها باید ۱۰۰ باشد.
        </p>
      </>
    );
  return null;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Settings({
  notify,
  error,
}: {
  notify: (s: string) => void;
  error: (s: string) => void;
}) {
  const { data, replace, storageIssue } = useFinance();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="settings-body">
      <div className="info-box">
        <ShieldCheck size={21} />
        <div>
          <strong>اطلاعات شما، روی دستگاه شما</strong>
          <p>
            داده‌ها در IndexedDB این مرورگر ذخیره می‌شوند. همگام‌سازی ابری فعال
            نیست؛ برای انتقال به دستگاه دیگر، پشتیبان بگیرید.
          </p>
        </div>
      </div>
      <button
        className="settings-row"
        disabled={storageIssue === "invalid"}
        onClick={() => {
          download(
            new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            }),
            `MET-backup-${new Date().toISOString().slice(0, 10)}.json`,
          );
          notify("فایل پشتیبان آماده شد.");
        }}
      >
        <FileJson size={23} />
        <span>
          <strong>دریافت نسخه پشتیبان</strong>
          <small>همه دارایی‌ها، صندوق‌ها و تاریخچه · JSON</small>
        </span>
        <Download size={19} />
      </button>
      <button className="settings-row" onClick={() => input.current?.click()}>
        <Upload size={23} />
        <span>
          <strong>بازیابی نسخه پشتیبان</strong>
          <small>جایگزینی اطلاعات فعلی با فایل معتبر</small>
        </span>
        <Upload size={19} />
      </button>
      <input
        type="file"
        accept="application/json,.json"
        hidden
        ref={input}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 5 * 1024 * 1024)
              throw new Error("اندازه فایل بیش از حد مجاز است.");
            const parsed: unknown = JSON.parse(await file.text());
            if (!validateBackup(parsed))
              throw new Error("ساختار فایل پشتیبان معتبر نیست.");
            if (
              window.confirm("همه اطلاعات فعلی با نسخه پشتیبان جایگزین شود؟")
            ) {
              replace(parsed);
              notify(
                "اطلاعات برای ذخیره بازیابی شد؛ وضعیت ذخیره دستگاه را بررسی کنید.",
              );
              error("");
            }
          } catch (err) {
            error(err instanceof Error ? err.message : "بازیابی انجام نشد.");
          }
          e.target.value = "";
        }}
      />
      <div className="settings-foot">
        <span>متافایننس · نسخه ۱.۰</span>
        <span>Offline-first / Local storage</span>
      </div>
    </div>
  );
}
function Report({ notify }: { notify: (s: string) => void }) {
  const { data } = useFinance();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("all");
  const [exporting, setExporting] = useState(false);
  const invalidRange = Boolean(from && to && from > to);
  const rows = reportTransactions(data.transactions, from, to, kind);
  async function excel() {
    setExporting(true);
    try {
      const blob = await createExcelReport(rows);
      download(blob, "MET-report.xlsx");
      notify("فایل اکسل آماده شد.");
    } catch {
      notify("خروجی اکسل انجام نشد.");
    } finally {
      setExporting(false);
    }
  }
  const csv = () => {
    if (invalidRange) return;
    download(
      new Blob([createCsvReport(rows)], { type: "text/csv;charset=utf-8" }),
      "MET-report.csv",
    );
    notify("فایل CSV آماده شد.");
  };
  return (
    <div className="report-body">
      <div className="report-filters">
        <JalaliDateField
          label="از تاریخ · شمسی"
          value={from}
          onChange={setFrom}
          optional
        />
        <JalaliDateField
          label="تا تاریخ · شمسی"
          value={to}
          onChange={setTo}
          optional
        />
        <Field label="نوع تراکنش">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">همه تراکنش‌ها</option>
            <option value="income">درآمدها</option>
            <option value="expense">هزینه‌ها</option>
            <option value="conversion">تبدیل دارایی</option>
          </select>
        </Field>
      </div>
      {invalidRange && (
        <p role="alert" className="form-error">
          تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.
        </p>
      )}
      <div className="export-actions">
        <button
          className="secondary"
          disabled={invalidRange || exporting}
          onClick={() => void excel()}
        >
          <FileSpreadsheet size={18} />
          {exporting ? "در حال ساخت…" : "Excel"}
        </button>
        <button className="secondary" disabled={invalidRange} onClick={csv}>
          <Download size={18} />
          CSV
        </button>
        <button
          className="primary"
          disabled={invalidRange}
          onClick={() => window.print()}
        >
          <Printer size={18} />
          چاپ / PDF
        </button>
      </div>
      <div className="print-report">
        <h2 className="print-only">
          گزارش مالی متافایننس — {jalali(new Date())}
        </h2>
        <div className="report-summary">
          <span>{fa(rows.length)} تراکنش</span>
          <span>
            درآمد:{" "}
            <Money
              value={rows
                .filter((t) => t.kind === "income")
                .reduce((s, t) => s + t.amount, 0)}
            />
          </span>
          <span>
            هزینه:{" "}
            <Money
              value={rows
                .filter((t) => t.kind === "expense")
                .reduce((s, t) => s + t.amount, 0)}
            />
          </span>
        </div>
        <Transactions rows={rows} rates={data.rates} />
      </div>
      <p className="helper">
        برای دریافت PDF، در پنجره چاپ مرورگر گزینه Save as PDF را انتخاب کنید.
        نرخ‌های تاریخی در گزارش حفظ می‌شوند.
      </p>
    </div>
  );
}
