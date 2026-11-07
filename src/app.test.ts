import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import "fake-indexeddb/auto";
const win = new Window({ url: "https://met.test/" });
for (const key of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "FormData",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
]) {
  const value =
    key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}
Object.defineProperty(win.Element.prototype, "animate", {
  value: undefined,
  configurable: true,
});
Object.defineProperty(win.HTMLElement.prototype, "getBoundingClientRect", {
  value: () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 640,
    bottom: 280,
    width: 640,
    height: 280,
    toJSON: () => ({}),
  }),
  configurable: true,
});
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: win.requestAnimationFrame.bind(win),
  configurable: true,
});
Object.defineProperty(globalThis, "cancelAnimationFrame", {
  value: win.cancelAnimationFrame.bind(win),
  configurable: true,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
  configurable: true,
});
const React = await import("react");
const { render, fireEvent, waitFor, within, cleanup } =
  await import("@testing-library/react");
const { default: App } = await import("./App");
const { useFinance } = await import("./store");
const { seed: fixture } = await import("./test-fixtures");
Object.defineProperty(globalThis, "fetch", {
  value: async () => {
    throw new Error("offline test");
  },
  configurable: true,
});
test("Application integration: navigate all sections, theme, income, expense, vault, notes and persistence", async () => {
  await useFinance.getState().hydrate();
  useFinance.getState().replace(structuredClone(fixture));
  const view = render(React.createElement(App));
  await waitFor(() => assert.ok(view.getByText("جریان درآمد و هزینه")));
  assert.equal(document.querySelectorAll(".met-badge").length, 1);
  fireEvent.click(view.getByRole("button", { name: "فعال کردن تم روشن" }));
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(localStorage.getItem("met-theme"), "light");
  const nav = within(document.querySelector("aside nav") as HTMLElement);
  for (const label of [
    "چرخه مالی",
    "بیزنس‌ها",
    "درآمدها",
    "دارایی‌ها",
    "هزینه‌ها",
    "خزانه",
    "یادداشت و آموزش",
    "نمای کلی",
  ]) {
    fireEvent.click(nav.getByRole("button", { name: new RegExp(`^${label}`) }));
    await waitFor(() =>
      assert.equal(
        document
          .querySelector('aside [aria-current="page"]')
          ?.textContent?.replace("جدید", ""),
        label,
      ),
    );
    await waitFor(() =>
      assert.ok(document.querySelector("main h1")?.textContent),
    );
    assert.equal(document.querySelectorAll(".met-badge").length, 1);
  }
  fireEvent.click(nav.getByRole("button", { name: "درآمدها" }));
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "ثبت درآمد" })),
  );
  fireEvent.click(view.getByRole("button", { name: "ثبت درآمد" }));
  let dialog = await view.findByRole("dialog");
  const before = useFinance.getState().data.transactions.length;
  fireEvent.change(dialog.querySelector('[name="title"]')!, {
    target: { value: "درآمد تست تعاملی" },
  });
  fireEvent.change(dialog.querySelector('[name="amount"]')!, {
    target: { value: "۱۰۰۰۰۰۰" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() =>
    assert.equal(useFinance.getState().data.transactions.length, before + 1),
  );
  assert.equal(useFinance.getState().data.transactions[0].amount, 1_000_000);
  await waitFor(() => assert.equal(view.queryByRole("dialog"), null));
  fireEvent.click(nav.getByRole("button", { name: "هزینه‌ها" }));
  const heading = within(
    document.querySelector(".heading-actions") as HTMLElement,
  );
  await waitFor(() =>
    assert.ok(heading.getByRole("button", { name: "ثبت هزینه" })),
  );
  fireEvent.click(heading.getByRole("button", { name: "ثبت هزینه" }));
  dialog = await view.findByRole("dialog");
  fireEvent.change(dialog.querySelector('[name="title"]')!, {
    target: { value: "هزینه بیش از موجودی" },
  });
  fireEvent.change(dialog.querySelector('[name="amount"]')!, {
    target: { value: "999999999999999" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() =>
    assert.match(
      dialog.textContent ?? "",
      /موجودی صندوق برای این هزینه کافی نیست/,
    ),
  );
  assert.equal(useFinance.getState().data.transactions.length, before + 1);
  fireEvent.change(dialog.querySelector('[name="amount"]')!, {
    target: { value: "10000" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() => assert.equal(view.queryByRole("dialog"), null));
  assert.equal(useFinance.getState().data.transactions.length, before + 2);
  fireEvent.click(nav.getByRole("button", { name: "خزانه" }));
  await waitFor(
    () =>
      assert.equal(
        view.getAllByRole("button", { name: /واریز \/ برداشت/ }).length,
        2,
      ),
    { timeout: 5000 },
  );
  fireEvent.click(view.getAllByRole("button", { name: /واریز \/ برداشت/ })[1]);
  dialog = await view.findByRole("dialog");
  assert.equal(
    (dialog.querySelector('[name="currency"]') as HTMLSelectElement).value,
    "USD",
  );
  const oldUsd = useFinance.getState().data.vault.usd;
  fireEvent.change(dialog.querySelector('[name="quantity"]')!, {
    target: { value: "100" },
  });
  fireEvent.change(dialog.querySelector('[name="source"]')!, {
    target: { value: "پس‌انداز خارجی" },
  });
  fireEvent.change(dialog.querySelector('[name="reason"]')!, {
    target: { value: "تنوع ذخایر" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() =>
    assert.equal(useFinance.getState().data.vault.usd, oldUsd + 100),
  );
  assert.equal(view.queryByRole("dialog"), null);
  fireEvent.click(nav.getByRole("button", { name: /یادداشت و آموزش/ }));
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "یادداشت جدید" })),
  );
  fireEvent.click(view.getByRole("button", { name: "یادداشت جدید" }));
  dialog = await view.findByRole("dialog");
  fireEvent.change(dialog.querySelector('[name="title"]')!, {
    target: { value: "یادداشت تست" },
  });
  fireEvent.change(dialog.querySelector('[name="body"]')!, {
    target: { value: "متن یادداشت برای ذخیره دائمی" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() => assert.ok(view.getByText("یادداشت تست")));
  await waitFor(() => assert.equal(useFinance.getState().persistence, "saved"));
  const notes = useFinance.getState().data.notes.length;
  await React.act(async () => {
    await useFinance.getState().hydrate();
  });
  assert.equal(useFinance.getState().data.notes.length, notes);
  assert.equal(useFinance.getState().data.vault.usd, oldUsd + 100);
  cleanup();
  win.history.replaceState(null, "", "/");
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage")!;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage blocked", "SecurityError");
    },
  });
  try {
    const blocked = render(React.createElement(App));
    await waitFor(() =>
      assert.ok(blocked.getByText("یک نگاه، به تمام دنیای مالی تو")),
    );
    fireEvent.click(blocked.getByRole("button", { name: "فعال کردن تم روشن" }));
    assert.equal(document.documentElement.dataset.theme, "light");
  } finally {
    cleanup();
    Object.defineProperty(globalThis, "localStorage", storage);
  }
  await win.happyDOM.abort();
});

test("Empty onboarding, manual rates, transaction editing and confirmed deletion survive hydration", async () => {
  const { seed } = await import("./seed");
  useFinance.getState().replace(structuredClone(seed));
  await useFinance.getState().hydrate();
  win.history.replaceState(null, "", "/");
  const view = render(React.createElement(App));
  await waitFor(() =>
    assert.ok(view.getByText("داستان مالی شما از اینجا شروع می‌شود")),
  );
  assert.equal(document.querySelectorAll(".tx-title").length, 0);
  fireEvent.click(view.getByRole("button", { name: "ثبت دستی نرخ‌های بازار" }));
  let dialog = await view.findByRole("dialog");
  for (const key of ["gold", "usd", "emami", "bahar"] as const)
    fireEvent.change(dialog.querySelector(`[name="${key}"]`)!, {
      target: { value: String(fixture.rates[key]) },
    });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() =>
    assert.equal(useFinance.getState().data.rates.source, "manual"),
  );
  fireEvent.click(view.getByRole("button", { name: "اولین درآمد" }));
  dialog = await view.findByRole("dialog");
  fireEvent.change(dialog.querySelector('[name="title"]')!, {
    target: { value: "درآمد واقعی" },
  });
  fireEvent.change(dialog.querySelector('[name="amount"]')!, {
    target: { value: "1000000" },
  });
  fireEvent.change(dialog.querySelector('[name="customSource"]')!, {
    target: { value: "کاربر" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() =>
    assert.equal(useFinance.getState().data.transactions.length, 1),
  );
  let row = view.getByText("درآمد واقعی").closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: "ویرایش" }));
  dialog = await view.findByRole("dialog");
  fireEvent.change(dialog.querySelector('[name="amount"]')!, {
    target: { value: "2000000" },
  });
  fireEvent.change(dialog.querySelector('[name="title"]')!, {
    target: { value: "درآمد اصلاح‌شده" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() =>
    assert.equal(useFinance.getState().data.transactions[0].amount, 2000000),
  );
  await React.act(async () => {
    await useFinance.getState().hydrate();
  });
  assert.equal(
    useFinance.getState().data.transactions[0].title,
    "درآمد اصلاح‌شده",
  );
  row = view.getByText("درآمد اصلاح‌شده").closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: "حذف" }));
  dialog = await view.findByRole("dialog");
  assert.equal(useFinance.getState().data.transactions.length, 1);
  fireEvent.click(within(dialog).getByRole("button", { name: "انصراف" }));
  assert.equal(useFinance.getState().data.transactions.length, 1);
  fireEvent.click(within(row).getByRole("button", { name: "حذف" }));
  dialog = await view.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "تأیید حذف" }));
  await waitFor(() =>
    assert.equal(useFinance.getState().data.transactions.length, 0),
  );
  await React.act(async () => {
    await useFinance.getState().hydrate();
  });
  assert.equal(useFinance.getState().data.transactions.length, 0);
  assert.equal(useFinance.getState().data.vaultEntries.length, 0);
  assert.ok(useFinance.getState().data.funds.every((f) => f.balance === 0));
  cleanup();
  await win.happyDOM.abort();
});
