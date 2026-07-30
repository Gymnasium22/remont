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

/** Доп. работа / материал в рамках позиции сметы (добавляется по ходу) */
export interface EstimateExtra {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  note?: string;
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
  /** 0–100 — общий прогресс выполнения */
  progress: number;
  /**
   * 0–100 — доля работы, сделанной своими силами (не нанятыми).
   * Даёт «экономию» = план × selfDonePercent / 100.
   */
  selfDonePercent: number;
  /**
   * Допработы и материалы, появившиеся в процессе
   * (мешки, вынос, вывоз мусора и т.п.). Входят в план позиции.
   */
  extras: EstimateExtra[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** Часть оплаты (можно несколько способов на один расход) */
export interface PaymentPart {
  method: PaymentMethod;
  amount: number;
}

export interface Expense {
  id: string;
  date: string;
  /** Итоговая сумма = сумма paymentParts */
  amount: number;
  /** Разбивка по способам оплаты */
  paymentParts: PaymentPart[];
  /** @deprecated → paymentParts */
  paymentMethod?: PaymentMethod;
  /** Позиции сметы (можно несколько) */
  estimateItemIds: string[];
  /** @deprecated → estimateItemIds */
  estimateItemId?: string | null;
  /** Зоны (можно несколько) — из позиций сметы */
  zoneIds: string[];
  /** @deprecated → zoneIds */
  zoneId?: string;
  /** Категории (можно несколько) — из позиций сметы */
  categoryIds: string[];
  /** @deprecated → categoryIds */
  categoryId?: string;
  /** Этапы (можно несколько) — из позиций сметы */
  stageIds: string[];
  /** @deprecated → stageIds */
  stageId?: string;
  /** Контрагенты (можно несколько) */
  contractorIds: string[];
  /** @deprecated → contractorIds */
  contractorId?: string | null;
  comment: string;
  /**
   * Вложения (фото чеков и т.п.), data URL.
   * @deprecated receiptPhoto — старое одно фото, мигрируется в attachments
   */
  attachments: string[];
  /** @deprecated → attachments */
  receiptPhoto?: string | null;
  /**
   * Ручное разнесение суммы по позициям сметы: itemId → сумма.
   * Если задано и покрывает позиции — вместо пропорционального деления по плану.
   */
  estimateShares?: Record<string, number>;
  /** Позиции «К покупке», к которым относится этот расход */
  wishlistItemIds: string[];
  createdAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
}

/** Статус позиции в списке покупок */
export type WishlistStatus = 'planned' | 'ordered' | 'bought';

/** Приоритет покупки */
export type WishlistPriority = 'low' | 'normal' | 'high';

/**
 * Позиция «что планируем купить» — название + кликабельная ссылка.
 * Не путать с Expense (уже оплаченный расход).
 */
export interface WishlistItem {
  id: string;
  /** Наименование товара / услуги */
  name: string;
  /** Ссылка на товар (магазин, маркетплейс, объявление) */
  url: string;
  /** Магазин / площадка (вручную или из домена URL) */
  store: string;
  /** Ожидаемая цена за единицу, Br (0 = не указана) */
  price: number;
  quantity: number;
  unit: string;
  zoneIds: string[];
  categoryId: string | null;
  priority: WishlistPriority;
  status: WishlistStatus;
  note: string;
  /** Связанные расходы (оплаты этой покупки) */
  expenseIds: string[];
  createdAt: string;
  updatedAt: string;
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
  /** Список покупок со ссылками (вишлист) */
  wishlistItems: WishlistItem[];
  settings: AppSettings;
}

export const WISHLIST_STATUS_LABELS: Record<WishlistStatus, string> = {
  planned: 'Планируем',
  ordered: 'Заказано',
  bought: 'Куплено',
};

export const WISHLIST_PRIORITY_LABELS: Record<WishlistPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Срочно',
};

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
