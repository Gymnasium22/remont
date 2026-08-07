export type PaymentMethod = 'cash' | 'card' | 'transfer';
export type ThemeMode = 'light' | 'dark' | 'system';

/** Текущая версия схемы AppData (IndexedDB / export JSON) */
export const APP_DATA_VERSION = 2 as const;
export type AppDataVersion = 1 | 2;

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

/**
 * Происхождение позиции сметы:
 * - original — была в первоначальной смете
 * - added — новая позиция, появившаяся в процессе ремонта
 *   (не доп. к существующей, а отдельная работа)
 */
export type EstimateOrigin = 'original' | 'added';

export const ESTIMATE_ORIGIN_LABELS: Record<EstimateOrigin, string> = {
  original: 'Изначально',
  added: 'По ходу',
};

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
  /**
   * Изначально в смете или добавлена по ходу ремонта.
   * Старые данные без поля → original при миграции.
   */
  origin: EstimateOrigin;
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

/** Вариант магазина / ссылки для сравнения цен */
export interface WishlistOffer {
  id: string;
  url: string;
  store: string;
  /** Цена за единицу, Br */
  unitPrice: number;
  note: string;
}

/**
 * Позиция «что планируем купить» — название + кликабельные ссылки.
 * Не путать с Expense (уже оплаченный расход).
 */
export interface WishlistItem {
  id: string;
  /** Наименование товара / услуги */
  name: string;
  /**
   * Основная ссылка (для совместимости и быстрого открытия).
   * Синхронизируется с лучшим / первым offer.
   */
  url: string;
  store: string;
  /** Ожидаемая цена за единицу (лучшая из offers или ручная), Br */
  price: number;
  /** Альтернативные магазины для сравнения */
  offers: WishlistOffer[];
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

/** Остатки материалов на объекте */
export interface MaterialStock {
  id: string;
  name: string;
  unit: string;
  /** Куплено / поступило */
  qtyIn: number;
  /** Израсходовано */
  qtyOut: number;
  zoneIds: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** Фото зоны: до / процесс / после */
export type ZonePhotoKind = 'before' | 'process' | 'after';

export interface ZonePhoto {
  id: string;
  zoneId: string;
  kind: ZonePhotoKind;
  /** data URL (сжатое) */
  dataUrl: string;
  caption: string;
  takenAt: string;
  createdAt: string;
}

export interface AppData {
  version: typeof APP_DATA_VERSION;
  project: Project;
  zones: Zone[];
  categories: Category[];
  stages: Stage[];
  contractors: Contractor[];
  estimateItems: EstimateItem[];
  expenses: Expense[];
  /** Список покупок со ссылками (вишлист) */
  wishlistItems: WishlistItem[];
  /** Склад материалов */
  materials: MaterialStock[];
  /** Фото по зонам */
  zonePhotos: ZonePhoto[];
  settings: AppSettings;
}

/** Сырые данные v1 (импорт / IDB до миграции) */
export type AppDataV1 = Omit<
  AppData,
  'version' | 'materials' | 'zonePhotos' | 'wishlistItems'
> & {
  version: 1;
  wishlistItems?: WishlistItem[];
};

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

export const ZONE_PHOTO_KIND_LABELS: Record<ZonePhotoKind, string> = {
  before: 'До',
  process: 'Процесс',
  after: 'После',
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
  'мешок',
  'рулон',
  'лист',
  'услуга',
  'работа',
] as const;
