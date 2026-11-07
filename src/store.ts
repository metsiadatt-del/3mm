import Dexie, { type Table } from 'dexie';
import { create } from 'zustand';
import { seed } from './seed';
import { validateBackup } from './finance';
import type { FinanceData } from './types';
class FinanceDB extends Dexie {
  state!: Table<{ id: string; data: FinanceData }>;
  constructor() { super('met-finance'); this.version(1).stores({ state: 'id' }); }
}
const db = new FinanceDB();
let writes = Promise.resolve();
let hydration: Promise<void> | undefined;
interface Store {
  data: FinanceData;
  ready: boolean;
  persistence: 'loading' | 'saved' | 'saving' | 'error';
  storageIssue: 'invalid' | 'unavailable' | null;
  update: (fn: (data: FinanceData) => FinanceData) => void;
  replace: (data: FinanceData) => void;
  hydrate: () => Promise<void>;
}
export const useFinance = create<Store>((set, get) => {
  const save = (data: FinanceData) => {
    set({ data, persistence: 'saving' });
    writes = writes.catch(() => {}).then(async () => {
      try {
        await db.state.put({ id: 'main', data });
        if (get().data === data) set({ persistence: 'saved', storageIssue: null });
      } catch {
        set({ persistence: 'error', storageIssue: get().storageIssue === 'invalid' ? 'invalid' : 'unavailable' });
      }
    });
  };
  return {
    data: structuredClone(seed), ready: false, persistence: 'loading', storageIssue: null,
    hydrate: () => {
      if (!hydration) hydration = (async () => {
        try {
          await writes;
          const saved = await db.state.get('main');
          if (saved && !validateBackup(saved.data)) {
            set({ ready: true, persistence: 'error', storageIssue: 'invalid' });
            return;
          }
          if (saved) set({ data: saved.data });
          else await db.state.put({ id: 'main', data: get().data });
          set({ ready: true, persistence: 'saved', storageIssue: null });
        } catch {
          set({ ready: true, persistence: 'error', storageIssue: 'unavailable' });
        }
      })().finally(() => { hydration = undefined; });
      return hydration;
    },
    update: fn => {
      if (get().storageIssue === 'invalid') throw new Error('داده ذخیره‌شده نامعتبر است؛ ابتدا پشتیبان معتبر را بازیابی کنید.');
      save(fn(get().data));
    },
    replace: data => {
      if (!validateBackup(data)) throw new Error('ساختار فایل پشتیبان معتبر نیست.');
      save(structuredClone(data));
    },
  };
});
