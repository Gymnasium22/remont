import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { MultiChips } from '../components/ui/multi-chips';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { formatBr } from '../lib/currency';
import { cn, formatDate } from '../lib/utils';
import {
  expensesForWishlistItem,
  normalizeUrl,
  storeFromUrl,
  wishlistLineTotal,
  wishlistPaidTotal,
} from '../lib/wishlist';
import { useAppStore } from '../store/useAppStore';
import type {
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from '../types';
import {
  UNITS,
  WISHLIST_PRIORITY_LABELS,
  WISHLIST_STATUS_LABELS,
} from '../types';

type FormState = {
  name: string;
  url: string;
  store: string;
  price: string;
  quantity: string;
  unit: string;
  zoneIds: string[];
  categoryId: string;
  priority: WishlistPriority;
  status: WishlistStatus;
  note: string;
};

const emptyForm = (): FormState => ({
  name: '',
  url: '',
  store: '',
  price: '',
  quantity: '1',
  unit: 'шт',
  zoneIds: [],
  categoryId: '',
  priority: 'normal',
  status: 'planned',
  note: '',
});

type StatusFilter = 'all' | WishlistStatus;
type SortKey = 'priority' | 'price' | 'name' | 'date';

const PRIORITY_ORDER: Record<WishlistPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

const STATUS_ORDER: Record<WishlistStatus, number> = {
  planned: 0,
  ordered: 1,
  bought: 2,
};

function formFromItem(item: WishlistItem): FormState {
  return {
    name: item.name,
    url: item.url,
    store: item.store,
    price: item.price > 0 ? String(item.price) : '',
    quantity: String(item.quantity || 1),
    unit: item.unit || 'шт',
    zoneIds: [...item.zoneIds],
    categoryId: item.categoryId ?? '',
    priority: item.priority,
    status: item.status,
    note: item.note,
  };
}

function toPayload(form: FormState, expenseIds: string[] = []) {
  const url = normalizeUrl(form.url);
  const store =
    form.store.trim() || (url ? storeFromUrl(url) : '');
  return {
    name: form.name.trim(),
    url,
    store,
    price: Math.max(0, Number(form.price) || 0),
    quantity: Math.max(0.001, Number(form.quantity) || 1),
    unit: form.unit.trim() || 'шт',
    zoneIds: form.zoneIds,
    categoryId: form.categoryId || null,
    priority: form.priority,
    status: form.status,
    note: form.note.trim(),
    expenseIds,
  };
}

function hostLabel(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

export function WishlistPage() {
  const navigate = useNavigate();
  const zones = useAppStore((s) => s.zones);
  const categories = useAppStore((s) => s.categories);
  const project = useAppStore((s) => s.project);
  const expenses = useAppStore((s) => s.expenses);
  const wishlistItems = useAppStore((s) => s.wishlistItems ?? []);
  const add = useAppStore((s) => s.addWishlistItem);
  const update = useAppStore((s) => s.updateWishlistItem);
  const remove = useAppStore((s) => s.removeWishlistItem);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WishlistItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('priority');

  const activeZones = useMemo(() => {
    const active = new Set(project.activeZones);
    const list = zones.filter((z) => active.has(z.id));
    return list.length > 0 ? list : zones;
  }, [zones, project.activeZones]);

  const stats = useMemo(() => {
    const openItems = wishlistItems.filter((w) => w.status !== 'bought');
    const planned = wishlistItems.filter((w) => w.status === 'planned');
    const ordered = wishlistItems.filter((w) => w.status === 'ordered');
    const bought = wishlistItems.filter((w) => w.status === 'bought');
    const openSum = openItems.reduce((s, w) => s + wishlistLineTotal(w), 0);
    const boughtSum = bought.reduce((s, w) => s + wishlistLineTotal(w), 0);
    const paidSum = wishlistItems.reduce(
      (s, w) => s + wishlistPaidTotal(expenses, w),
      0,
    );
    const withExpense = wishlistItems.filter(
      (w) => expensesForWishlistItem(expenses, w.id, w).length > 0,
    ).length;
    return {
      total: wishlistItems.length,
      planned: planned.length,
      ordered: ordered.length,
      bought: bought.length,
      openSum,
      boughtSum,
      paidSum,
      withExpense,
    };
  }, [wishlistItems, expenses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...wishlistItems];

    if (statusFilter !== 'all') {
      list = list.filter((w) => w.status === statusFilter);
    }
    if (zoneFilter !== 'all') {
      list = list.filter((w) => w.zoneIds.includes(zoneFilter));
    }
    if (q) {
      list = list.filter((w) => {
        const hay = [w.name, w.store, w.url, w.note, w.unit]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sortKey === 'priority') {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (pd !== 0) return pd;
        const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (sd !== 0) return sd;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
      if (sortKey === 'price') {
        return wishlistLineTotal(b) - wishlistLineTotal(a);
      }
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name, 'ru');
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return list;
  }, [wishlistItems, query, statusFilter, zoneFilter, sortKey]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (item: WishlistItem) => {
    setEditing(item);
    setForm(formFromItem(item));
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Укажите наименование');
      return;
    }
    if (!form.url.trim()) {
      toast.error('Укажите ссылку на товар');
      return;
    }
    const payload = toPayload(form, editing?.expenseIds ?? []);
    if (!payload.url) {
      toast.error('Некорректная ссылка');
      return;
    }
    if (editing) {
      update(editing.id, payload);
      toast.success('Позиция обновлена');
    } else {
      add(payload);
      toast.success('Добавлено в список покупок');
    }
    setOpen(false);
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(normalizeUrl(url));
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const markBought = (item: WishlistItem) => {
    update(item.id, { status: 'bought' });
    toast.success('Отмечено как куплено');
  };

  /** Переход в расходы с prefills из позиции списка */
  const goToExpense = (item: WishlistItem) => {
    navigate(
      `/expenses?new=1&kind=shop&wishlist=${encodeURIComponent(item.id)}`,
    );
  };

  const openLinkedExpense = (expenseId: string) => {
    navigate(`/expenses?edit=${encodeURIComponent(expenseId)}`);
  };

  const cycleStatus = (item: WishlistItem) => {
    const next: WishlistStatus =
      item.status === 'planned'
        ? 'ordered'
        : item.status === 'ordered'
          ? 'bought'
          : 'planned';
    update(item.id, { status: next });
    toast.success(WISHLIST_STATUS_LABELS[next]);
  };

  const onUrlBlur = () => {
    if (!form.store.trim() && form.url.trim()) {
      const s = storeFromUrl(form.url);
      if (s) setForm((f) => ({ ...f, store: s }));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="К покупке"
        subtitle="Ссылки + оплата через раздел «Расходы»"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      {wishlistItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Всего позиций</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {stats.total}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stats.planned} план · {stats.ordered} заказ · {stats.bought}{' '}
                куплено
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Ещё купить</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                {formatBr(stats.openSum)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                план по открытым
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Оплачено по факту</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatBr(stats.paidSum)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stats.withExpense} поз. со связью к расходам
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">План «куплено»</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {formatBr(stats.boughtSum)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                оценка цен · {stats.planned + stats.ordered} открыто
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {wishlistItems.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Список покупок пуст"
          description="Добавляйте товары с названием и ссылкой на магазин — удобно открывать с телефона на объекте или сравнивать варианты."
          actionLabel="Добавить позицию"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Поиск по названию, магазину…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {(Object.keys(WISHLIST_STATUS_LABELS) as WishlistStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {WISHLIST_STATUS_LABELS[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Зона" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все зоны</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">По приоритету</SelectItem>
                <SelectItem value="price">По сумме</SelectItem>
                <SelectItem value="name">По названию</SelectItem>
                <SelectItem value="date">По дате</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Ничего не найдено"
              description="Сбросьте фильтры или измените поисковый запрос."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const line = wishlistLineTotal(item);
                const zoneList = zones.filter((z) =>
                  item.zoneIds.includes(z.id),
                );
                const cat = categories.find((c) => c.id === item.categoryId);
                const href = item.url ? normalizeUrl(item.url) : '';
                const isDone = item.status === 'bought';
                const linkedExps = expensesForWishlistItem(
                  expenses,
                  item.id,
                  item,
                );
                const paid = linkedExps.reduce((s, e) => s + e.amount, 0);
                const delta =
                  line > 0 && paid > 0
                    ? Math.round((paid - line) * 100) / 100
                    : 0;

                return (
                  <Card
                    key={item.id}
                    className={cn(
                      'transition-opacity',
                      isDone && 'opacity-70',
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          title="Сменить статус"
                          onClick={() => cycleStatus(item)}
                          className={cn(
                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                            item.status === 'bought' &&
                              'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                            item.status === 'ordered' &&
                              'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400',
                            item.status === 'planned' &&
                              'border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-primary',
                          )}
                        >
                          {item.status === 'bought' ? (
                            <Check className="h-4 w-4" />
                          ) : item.status === 'ordered' ? (
                            <Package className="h-4 w-4" />
                          ) : (
                            <ShoppingBag className="h-4 w-4" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    'group inline-flex max-w-full items-start gap-1.5 font-semibold text-foreground hover:text-primary',
                                    isDone && 'line-through decoration-muted-foreground/60',
                                  )}
                                >
                                  <span className="break-words">{item.name}</span>
                                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                                </a>
                              ) : (
                                <h3
                                  className={cn(
                                    'font-semibold',
                                    isDone && 'line-through',
                                  )}
                                >
                                  {item.name}
                                </h3>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                {(item.store || (href && hostLabel(href))) && (
                                  <span className="inline-flex items-center gap-1">
                                    <Link2 className="h-3 w-3" />
                                    {item.store || hostLabel(href)}
                                  </span>
                                )}
                                {item.quantity > 0 && (
                                  <span>
                                    {item.quantity} {item.unit}
                                    {item.price > 0 && (
                                      <>
                                        {' '}
                                        × {formatBr(item.price)}
                                      </>
                                    )}
                                  </span>
                                )}
                                {item.createdAt && (
                                  <span>{formatDate(item.createdAt.slice(0, 10))}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {paid > 0 ? (
                                <>
                                  <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                    {formatBr(paid)}
                                  </span>
                                  {line > 0 && (
                                    <span className="text-[11px] text-muted-foreground">
                                      план {formatBr(line)}
                                      {delta !== 0 && (
                                        <span
                                          className={cn(
                                            'ml-1 font-medium',
                                            delta < 0
                                              ? 'text-emerald-600 dark:text-emerald-400'
                                              : 'text-amber-600 dark:text-amber-400',
                                          )}
                                        >
                                          {delta < 0
                                            ? `−${formatBr(Math.abs(delta))}`
                                            : `+${formatBr(delta)}`}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </>
                              ) : line > 0 ? (
                                <span className="text-base font-bold tabular-nums">
                                  {formatBr(line)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  цена не указана
                                </span>
                              )}
                              <div className="flex gap-0.5">
                                {href && (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    title="Копировать ссылку"
                                    onClick={() => void copyLink(href)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                )}
                                {href && (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    title="Открыть"
                                    asChild
                                  >
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => openEdit(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => setDeleteId(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={
                                item.status === 'bought'
                                  ? 'success'
                                  : item.status === 'ordered'
                                    ? 'warning'
                                    : 'default'
                              }
                              className="cursor-pointer"
                              onClick={() => cycleStatus(item)}
                            >
                              {WISHLIST_STATUS_LABELS[item.status]}
                            </Badge>
                            {item.priority === 'high' && (
                              <Badge variant="danger">
                                {WISHLIST_PRIORITY_LABELS.high}
                              </Badge>
                            )}
                            {item.priority === 'low' && (
                              <Badge variant="secondary">
                                {WISHLIST_PRIORITY_LABELS.low}
                              </Badge>
                            )}
                            {zoneList.map((z) => (
                              <Badge
                                key={z.id}
                                variant="outline"
                                className="gap-1"
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: z.color }}
                                />
                                {z.name}
                              </Badge>
                            ))}
                            {cat && (
                              <Badge variant="secondary">{cat.name}</Badge>
                            )}
                            {linkedExps.length > 0 && (
                              <Badge variant="success" className="gap-1">
                                <Receipt className="h-3 w-3" />
                                {linkedExps.length === 1
                                  ? 'В расходах'
                                  : `${linkedExps.length} расхода`}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => goToExpense(item)}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              {paid > 0 ? 'Ещё расход' : 'В расходы'}
                            </Button>
                            {linkedExps.slice(0, 2).map((e) => (
                              <Button
                                key={e.id}
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => openLinkedExpense(e.id)}
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                {formatBr(e.amount)} · {formatDate(e.date)}
                              </Button>
                            ))}
                            {linkedExps.length > 2 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                asChild
                              >
                                <Link to="/expenses">
                                  +{linkedExps.length - 2}
                                </Link>
                              </Button>
                            )}
                            {!isDone && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-auto h-8 text-xs"
                                onClick={() => markBought(item)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Без расхода
                              </Button>
                            )}
                          </div>

                          {item.note && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {item.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать покупку' : 'Новая покупка'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Наименование *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ламинат, смеситель, люстра…"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Ссылка *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                onBlur={onUrlBlur}
                placeholder="https://… или onliner.by/…"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Кликабельная ссылка на товар. Можно без https:// — добавится
                сама.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>Магазин / площадка</Label>
              <Input
                value={form.store}
                onChange={(e) => setForm({ ...form, store: e.target.value })}
                placeholder="Подставится из ссылки, можно изменить"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1.5">
                <Label>Цена, Br</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Кол-во</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Ед.</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setForm({ ...form, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(Number(form.price) > 0 || Number(form.quantity) > 0) && (
              <p className="text-sm text-muted-foreground">
                Итого:{' '}
                <span className="font-semibold text-foreground">
                  {formatBr(
                    (Number(form.price) || 0) *
                      (Number(form.quantity) > 0
                        ? Number(form.quantity)
                        : 1),
                  )}
                </span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>Статус</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as WishlistStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(WISHLIST_STATUS_LABELS) as WishlistStatus[]
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {WISHLIST_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Приоритет</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({ ...form, priority: v as WishlistPriority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(
                        WISHLIST_PRIORITY_LABELS,
                      ) as WishlistPriority[]
                    ).map((p) => (
                      <SelectItem key={p} value={p}>
                        {WISHLIST_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Зоны</Label>
              <MultiChips
                options={activeZones.map((z) => ({
                  id: z.id,
                  name: z.name,
                  color: z.color,
                }))}
                selected={form.zoneIds}
                onToggle={(id) =>
                  setForm((f) => ({
                    ...f,
                    zoneIds: f.zoneIds.includes(id)
                      ? f.zoneIds.filter((x) => x !== id)
                      : [...f.zoneIds, id],
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Категория</Label>
              <Select
                value={form.categoryId || '__none__'}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    categoryId: v === '__none__' ? '' : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Не указана" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не указана</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Заметка</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Цвет, артикул, альтернативы, размеры…"
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={save}>
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Удалить позицию?"
        description="Ссылка и данные о покупке будут удалены из списка."
        confirmLabel="Удалить"
        destructive
        onConfirm={() => {
          if (deleteId) {
            remove(deleteId);
            toast.success('Удалено');
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}
