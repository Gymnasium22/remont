export type PaymentMethod = 'cash' | 'card' | 'transfer';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Zone {
  id: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  isCustom?: boolean;
}

export interface Contractor {
  id: string;
  name: string;
  phone: string;
  telegram: string;
  note: string;
}

export interface Project {
  name: string;
  startDate: string;
  totalBudget: number;
  activeZones: string[];
}

export interface EstimateItem {
  id: string;
  name: string;
  /**
   * Зоны позиции. Можно несколько — когда работа/материал
   * относится сразу к нескольким комнатам.
   * @deprecated zoneId — старое поле, мигрируется в zoneIds
   */
  zoneIds: string[];
  /** @deprecated используйте zoneIds; оставлено для совместимости импорта */
  zoneId?: string;
  categoryId: string;
  stageId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** 0–100 */
  progress: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  estimateItemId: string | null;
  zoneId: string;
  categoryId: string;
  stageId: string;
  contractorId: string | null;
  comment: string;
  receiptPhoto: string | null;
  createdAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
}

export interface AppData {
  version: 1;
  project: Project;
  zones: Zone[];
  categories: Category[];
  stages: Stage[];
  contractors: Contractor[];
  estimateItems: EstimateItem[];
  expenses: Expense[];
  settings: AppSettings;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Наличные',
  card: 'Безнал',
  transfer: 'Перевод',
};

export const UNITS = [
  'шт',
  'м²',
  'м',
  'м³',
  'кг',
  'л',
  'уп',
  'компл',
  'услуга',
  'работа',
] as const;
