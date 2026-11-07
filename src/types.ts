export type Page = 'overview' | 'cycle' | 'businesses' | 'income' | 'assets' | 'expenses' | 'treasury' | 'academy';
export type Currency = 'TMN' | 'GOLD' | 'USD';
export interface Rates { gold: number; usd: number; emami: number; bahar: number; updatedAt: string; source: 'manual' }
export interface Fund { id: string; title: string; balance: number; percent: number; color: string }
export interface Business { id: string; title: string; description: string; startDate: string; initialCapital: number; workingCapital: number; reserveGold: number; color: string }
export interface Asset { id: string; title: string; category: string; purchasePrice: number; value: number; purchaseGold: number; purchasedAt: string; status: 'active' | 'sold'; realizedGain?: number }
export interface Allocation { fundId: string; amount: number }
export interface Transaction { id: string; kind: 'income' | 'expense' | 'conversion'; title: string; amount: number; gold: number; usd: number; rateGold: number; rateUsd: number; date: string; source: string; category: string; fundId?: string; businessId?: string; allocations?: Allocation[] }
export interface VaultEntry { id: string; currency: 'GOLD' | 'USD'; direction: 'deposit' | 'withdraw'; quantity: number; source: string; reason: string; memo: string; date: string; rate: number }
export interface Note { id: string; title: string; body: string; tag: string; date: string; pinned: boolean }
export interface FinanceData { version: 1; rates: Rates; funds: Fund[]; businesses: Business[]; assets: Asset[]; transactions: Transaction[]; vault: { gold: number; usd: number }; vaultEntries: VaultEntry[]; notes: Note[] }
