import { useMemo, useState } from 'react';
import {
  Camera,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import {
  Dialog,
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
import {
  expenseHasCategory,
  expenseHasContractor,
  expenseHasZone,
  getExpenseCategoryIds,
  getExpenseContractorIds,
  getExpenseEstimateIds,
  getExpenseStageIds,
  getExpenseZoneIds,
  toggleId,
} from '../lib/expense';
import { compressImage, formatDate } from '../lib/utils';
import { getItemZoneIds } from '../lib/zones';
import { todayISO, useAppStore } from '../store/useAppStore';
import type { Expense, PaymentMethod } from '../types';
import { PAYMENT_LABELS } from '../types';

type FormState = {
  date: string;
  amount: string;
  paymentMethod: PaymentMethod;
  estimateItemIds: string[];
  zoneIds: string[];
  categoryIds: string[];
  stageIds: string[];
  contractorIds: string[];
  comment: string;
  receiptPhoto: string | null;
};

function freeDefaults(
  zones: { id: string }[],
  cats: { id: string }[],
  stages: { id: string }[],
) {
  return {
    zoneIds: zones[0]?.id ? [zones[0].id] : ([] as string[]),
    categoryIds: cats[0]?.id ? [cats[0].id] : ([] as string[]),
    stageIds: stages[0]?.id ? [stages[0].id] : ([] as string[]),
  };
}

function emptyForm(
  zones: { id: string }[],
  cats: { id: string }[],
  stages: { id: string }[],
): FormState {
  return {
    date: todayISO(),
    amount: '',
    paymentMethod: 'cash',
    estimateItemIds: [],
    ...freeDefaults(zones, cats, stages),
    contractorIds: [],
    comment: '',
    receiptPhoto: null,
  };
}

/** Зоны / категории / этапы строго из выбранных позиций сметы */
function deriveFromEstimateItems(
  itemIds: string[],
  estimateItems: {
    id: string;
    name: string;
    zoneIds?: string[];
    zoneId?: string;
    categoryId: string;
    stageId: string;
  }[],
  fallback: { zoneIds: string[]; categoryIds: string[]; stageIds: string[] },
) {
  if (itemIds.length === 0) return fallback;

  const zoneIds = new Set<string>();
  const categoryIds = new Set<string>();
  const stageIds = new Set<string>();

  for (const id of itemIds) {
    const item = estimateItems.find((i) => i.id === id);
    if (!item) continue;
    for (const z of getItemZoneIds({
      zoneIds: item.zoneIds ?? [],
      zoneId: item.zoneId,
    })) {
      zoneIds.add(z);
    }
    if (item.categoryId) categoryIds.add(item.categoryId);
    if (item.stageId) stageIds.add(item.stageId);
  }

  return {
    zoneIds: [...zoneIds],
    categoryIds: [...categoryIds],
    stageIds: [...stageIds],
  };
}

function autoCommentFromItems(
  itemIds: string[],
  estimateItems: { id: string; name: string }[],
): string {
  return itemIds
    .map((id) => estimateItems.find((i) => i.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

export function ExpensesPage() {
  const zones = useAppStore((s) => s.zones);
  const categories = useAppStore((s) => s.categories);
  const stages = useAppStore((s) => s.stages);
  const contractors = useAppStore((s) => s.contractors);
  const estimateItems = useAppStore((s) => s.estimateItems);
  const expenses = useAppStore((s) => s.expenses);
  const add = useAppStore((s) => s.addExpense);
  const update = useAppStore((s) => s.updateExpense);
  const remove = useAppStore((s) => s.removeExpense);

  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterPay, setFilterPay] = useState('all');
  const [filterContractor, setFilterContractor] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(zones, categories, stages),
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (filterZone !== 'all' && !expenseHasZone(e, filterZone)) return false;
        if (filterCat !== 'all' && !expenseHasCategory(e, filterCat))
          return false;
        if (filterPay !== 'all' && e.paymentMethod !== filterPay) return false;
        if (filterContractor !== 'all') {
          if (!expenseHasContractor(e, filterContractor)) return false;
        }
        if (dateFrom && e.date < dateFrom) return false;
        if (dateTo && e.date > dateTo) return false;
        if (q) {
          const names = getExpenseEstimateIds(e)
            .map((id) => estimateItems.find((i) => i.id === id)?.name ?? '')
            .join(' ');
          const hay = `${e.comment} ${names}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
  }, [
    expenses,
    search,
    filterZone,
    filterCat,
    filterPay,
    filterContractor,
    dateFrom,
    dateTo,
    estimateItems,
  ]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(zones, categories, stages));
    setOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      date: e.date,
      amount: String(e.amount),
      paymentMethod: e.paymentMethod,
      estimateItemIds: getExpenseEstimateIds(e),
      zoneIds: getExpenseZoneIds(e),
      categoryIds: getExpenseCategoryIds(e),
      stageIds: getExpenseStageIds(e),
      contractorIds: getExpenseContractorIds(e),
      comment: e.comment,
      receiptPhoto: e.receiptPhoto,
    });
    setOpen(true);
  };

  const toggleEstimate = (id: string) => {
    setForm((f) => {
      const nextIds = toggleId(f.estimateItemIds, id);
      const derived = deriveFromEstimateItems(
        nextIds,
        estimateItems,
        freeDefaults(zones, categories, stages),
      );

      const prevAuto = autoCommentFromItems(f.estimateItemIds, estimateItems);
      const nextAuto = autoCommentFromItems(nextIds, estimateItems);
      const commentWasAuto =
        !f.comment.trim() || f.comment.trim() === prevAuto.trim();

      return {
        ...f,
        estimateItemIds: nextIds,
        zoneIds: derived.zoneIds,
        categoryIds: derived.categoryIds,
        stageIds: derived.stageIds,
        comment: commentWasAuto ? nextAuto : f.comment,
      };
    });
  };

  const linkedToEstimate = form.estimateItemIds.length > 0;

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const data = await compressImage(file);
      setForm((f) => ({ ...f, receiptPhoto: data }));
      toast.success('Фото чека прикреплено');
    } catch {
      toast.error('Не удалось обработать фото');
    }
  };

  const save = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Укажите сумму расхода');
      return;
    }
    if (form.zoneIds.length === 0) {
      toast.error('Выберите хотя бы одну зону');
      return;
    }
    if (form.categoryIds.length === 0) {
      toast.error('Выберите хотя бы одну категорию');
      return;
    }
    if (form.stageIds.length === 0) {
      toast.error('Выберите хотя бы один этап');
      return;
    }
    const payload = {
      date: form.date || todayISO(),
      amount,
      paymentMethod: form.paymentMethod,
      estimateItemIds: form.estimateItemIds,
      estimateItemId: form.estimateItemIds[0] ?? null,
      zoneIds: form.zoneIds,
      zoneId: form.zoneIds[0],
      categoryIds: form.categoryIds,
      categoryId: form.categoryIds[0],
      stageIds: form.stageIds,
      stageId: form.stageIds[0],
      contractorIds: form.contractorIds,
      contractorId: form.contractorIds[0] ?? null,
      comment: form.comment.trim(),
      receiptPhoto: form.receiptPhoto,
    };
    if (editing) {
      update(editing.id, payload);
      toast.success('Расход обновлён');
    } else {
      add(payload);
      toast.success('Расход добавлен');
    }
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Расходы"
        subtitle={`${formatBr(total)} · ${filtered.length} записей`}
        action={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Поиск по комментарию или позиции…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setShowFilters((v) => !v)}
        >
          {showFilters ? 'Скрыть фильтры' : 'Фильтры'}
        </Button>
        {showFilters && (
          <div className="grid gap-3 rounded-3xl border border-border bg-card p-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Зона</Label>
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Категория</Label>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Оплата</Label>
              <Select value={filterPay} onValueChange={setFilterPay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PAYMENT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Контрагент</Label>
              <Select
                value={filterContractor}
                onValueChange={setFilterContractor}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="none">Без контрагента</SelectItem>
                  {contractors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>С даты</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>По дату</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            expenses.length === 0 ? 'Расходов пока нет' : 'Ничего не найдено'
          }
          description={
            expenses.length === 0
              ? 'Фиксируйте траты. Можно привязать сразу несколько зон, категорий, этапов, контрагентов и позиций сметы.'
              : 'Смягчите фильтры или измените период.'
          }
          actionLabel={expenses.length === 0 ? 'Добавить расход' : undefined}
          onAction={expenses.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const eZones = getExpenseZoneIds(e)
              .map((id) => zones.find((z) => z.id === id))
              .filter(Boolean) as typeof zones;
            const eCats = getExpenseCategoryIds(e)
              .map((id) => categories.find((c) => c.id === id))
              .filter(Boolean) as typeof categories;
            const eStages = getExpenseStageIds(e)
              .map((id) => stages.find((s) => s.id === id))
              .filter(Boolean) as typeof stages;
            const eContractors = getExpenseContractorIds(e)
              .map((id) => contractors.find((c) => c.id === id))
              .filter(Boolean) as typeof contractors;
            const eItems = getExpenseEstimateIds(e)
              .map((id) => estimateItems.find((i) => i.id === id))
              .filter(Boolean) as typeof estimateItems;
            return (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {formatBr(e.amount)}
                        </span>
                        <Badge variant="secondary">
                          {PAYMENT_LABELS[e.paymentMethod]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(e.date)}
                        {e.comment ? ` · ${e.comment}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {eZones.map((zone) => (
                          <Badge key={zone.id} variant="outline">
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full"
                              style={{ background: zone.color }}
                            />
                            {zone.name}
                          </Badge>
                        ))}
                        {eCats.map((cat) => (
                          <Badge key={cat.id} variant="secondary">
                            {cat.name}
                          </Badge>
                        ))}
                        {eStages.map((st) => (
                          <Badge key={st.id} variant="secondary">
                            {st.name}
                          </Badge>
                        ))}
                        {eItems.map((item) => (
                          <Badge key={item.id} variant="default">
                            Смета: {item.name}
                          </Badge>
                        ))}
                        {eContractors.map((c) => (
                          <Badge key={c.id} variant="outline">
                            {c.name}
                          </Badge>
                        ))}
                        {e.receiptPhoto && (
                          <button
                            type="button"
                            className="text-xs text-primary underline"
                            onClick={() => setPhotoPreview(e.receiptPhoto)}
                          >
                            Чек
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteId(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать расход' : 'Новый расход'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Сумма, Br</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Способ оплаты</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) =>
                  setForm({ ...form, paymentMethod: v as PaymentMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PAYMENT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Позиции сметы (можно несколько)</Label>
              <p className="text-xs text-muted-foreground">
                Зоны, категории и этапы заполняются только из выбранных
                позиций. Снимите позицию — связанные поля пересчитаются.
              </p>
              <MultiChips
                options={estimateItems.map((i) => ({
                  id: i.id,
                  name: i.name,
                }))}
                selected={form.estimateItemIds}
                onToggle={toggleEstimate}
                emptyLabel="Смета пуста — можно сохранить свободный расход"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>
                Зоны
                {linkedToEstimate ? ' (из сметы)' : ' (можно несколько)'}
              </Label>
              {linkedToEstimate && (
                <p className="text-xs text-muted-foreground">
                  Подставлено из позиций. Можно уточнить вручную; при смене
                  позиций сметы поля снова пересчитаются.
                </p>
              )}
              <MultiChips
                options={zones}
                selected={form.zoneIds}
                onToggle={(id) =>
                  setForm((f) => ({
                    ...f,
                    zoneIds: toggleId(f.zoneIds, id, {
                      minOne: f.estimateItemIds.length === 0,
                    }),
                  }))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label>
                Категории
                {linkedToEstimate ? ' (из сметы)' : ' (можно несколько)'}
              </Label>
              <MultiChips
                options={categories}
                selected={form.categoryIds}
                onToggle={(id) =>
                  setForm((f) => ({
                    ...f,
                    categoryIds: toggleId(f.categoryIds, id, {
                      minOne: f.estimateItemIds.length === 0,
                    }),
                  }))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label>
                Этапы
                {linkedToEstimate ? ' (из сметы)' : ' (можно несколько)'}
              </Label>
              <MultiChips
                options={stages.map((s) => ({ id: s.id, name: s.name }))}
                selected={form.stageIds}
                onToggle={(id) =>
                  setForm((f) => ({
                    ...f,
                    stageIds: toggleId(f.stageIds, id, {
                      minOne: f.estimateItemIds.length === 0,
                    }),
                  }))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Контрагенты (можно несколько)</Label>
              <MultiChips
                options={contractors.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
                selected={form.contractorIds}
                onToggle={(id) =>
                  setForm((f) => ({
                    ...f,
                    contractorIds: toggleId(f.contractorIds, id),
                  }))
                }
                emptyLabel="Контрагентов пока нет"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Комментарий</Label>
              <Textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Что купили / кому заплатили"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Фото чека</Label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium hover:bg-muted">
                  <Camera className="h-4 w-4" />
                  {form.receiptPhoto ? 'Заменить фото' : 'Прикрепить'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(ev) => onPhoto(ev.target.files?.[0] ?? null)}
                  />
                </label>
                {form.receiptPhoto && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ ...form, receiptPhoto: null })}
                  >
                    <X className="h-4 w-4" />
                    Убрать
                  </Button>
                )}
              </div>
              {form.receiptPhoto && (
                <img
                  src={form.receiptPhoto}
                  alt="Чек"
                  className="mt-2 max-h-40 rounded-2xl border object-contain"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={save}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Фото чека</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Чек"
              className="max-h-[70vh] w-full rounded-2xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Удалить расход?"
        description="Запись будет удалена безвозвратно."
        onConfirm={() => {
          if (deleteId) {
            remove(deleteId);
            toast.success('Расход удалён');
          }
        }}
      />
    </div>
  );
}
