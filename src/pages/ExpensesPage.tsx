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
import { CheckList } from '../components/ui/check-list';
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
  expenseHasPaymentMethod,
  expenseHasZone,
  getExpenseCategoryIds,
  getExpenseContractorIds,
  getExpenseEstimateIds,
  getExpenseStageIds,
  getExpenseZoneIds,
  getPaymentParts,
  paymentPartsTotal,
  toggleId,
} from '../lib/expense';
import { compressImage, cn, formatDate } from '../lib/utils';
import {
  getItemZoneIds,
  itemExpectedPaid,
  itemPlan,
  itemRemaining,
} from '../lib/zones';
import { selectItemFact, todayISO, useAppStore } from '../store/useAppStore';
import type { Expense, PaymentMethod, PaymentPart } from '../types';
import { PAYMENT_LABELS } from '../types';

const METHODS = Object.keys(PAYMENT_LABELS) as PaymentMethod[];

type FormState = {
  date: string;
  /** Суммы по способам оплаты, Br (строки для инпутов) */
  payCash: string;
  payCard: string;
  payTransfer: string;
  estimateItemIds: string[];
  zoneIds: string[];
  categoryIds: string[];
  stageIds: string[];
  contractorIds: string[];
  comment: string;
  receiptPhoto: string | null;
};

function emptyForm(): FormState {
  return {
    date: todayISO(),
    payCash: '',
    payCard: '',
    payTransfer: '',
    estimateItemIds: [],
    zoneIds: [],
    categoryIds: [],
    stageIds: [],
    contractorIds: [],
    comment: '',
    receiptPhoto: null,
  };
}

/** Зоны / категории / этапы строго из выбранных позиций сметы (без дефолтов) */
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
) {
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

function formToPaymentParts(form: FormState): PaymentPart[] {
  const parts: PaymentPart[] = [];
  const cash = Number(form.payCash) || 0;
  const card = Number(form.payCard) || 0;
  const transfer = Number(form.payTransfer) || 0;
  if (cash > 0) parts.push({ method: 'cash', amount: cash });
  if (card > 0) parts.push({ method: 'card', amount: card });
  if (transfer > 0) parts.push({ method: 'transfer', amount: transfer });
  return parts;
}

function partsToFormFields(parts: PaymentPart[]) {
  const by = (m: PaymentMethod) =>
    parts
      .filter((p) => p.method === m)
      .reduce((s, p) => s + p.amount, 0);
  const cash = by('cash');
  const card = by('card');
  const transfer = by('transfer');
  return {
    payCash: cash > 0 ? String(cash) : '',
    payCard: card > 0 ? String(card) : '',
    payTransfer: transfer > 0 ? String(transfer) : '',
  };
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
  const [form, setForm] = useState<FormState>(() => emptyForm());
  /** 0 — смета, 1 — оплата, 2 — детали */
  const [step, setStep] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (filterZone !== 'all' && !expenseHasZone(e, filterZone)) return false;
        if (filterCat !== 'all' && !expenseHasCategory(e, filterCat))
          return false;
        if (
          filterPay !== 'all' &&
          !expenseHasPaymentMethod(e, filterPay as PaymentMethod)
        )
          return false;
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
  const paymentPreview = formToPaymentParts(form);
  const totalFromPays = paymentPartsTotal(paymentPreview);
  const linkedToEstimate = form.estimateItemIds.length > 0;

  /** Остатки по выбранным позициям (для подсказки и автосуммы) */
  const selectedBreakdown = useMemo(() => {
    return form.estimateItemIds
      .map((id) => {
        const item = estimateItems.find((i) => i.id === id);
        if (!item) return null;
        const fact = selectItemFact(expenses, id, estimateItems);
        const plan = itemPlan(item);
        const expected = itemExpectedPaid(item);
        const remain = itemRemaining(item, fact);
        return { item, plan, expected, fact, remain };
      })
      .filter(Boolean) as {
      item: (typeof estimateItems)[0];
      plan: number;
      expected: number;
      fact: number;
      remain: number;
    }[];
  }, [form.estimateItemIds, estimateItems, expenses]);

  const selectedRemainingTotal = selectedBreakdown.reduce(
    (s, r) => s + r.remain,
    0,
  );

  const applyRemainingToCash = (remain: number) => {
    if (remain <= 0) {
      return { payCash: '', payCard: '', payTransfer: '' };
    }
    // Подставляем остаток в наличные (можно разбить вручную)
    return {
      payCash: String(Math.round(remain * 100) / 100),
      payCard: '',
      payTransfer: '',
    };
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setStep(0);
    setOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const parts = getPaymentParts(e);
    setForm({
      date: e.date,
      ...partsToFormFields(parts),
      estimateItemIds: getExpenseEstimateIds(e),
      zoneIds: getExpenseZoneIds(e),
      categoryIds: getExpenseCategoryIds(e),
      stageIds: getExpenseStageIds(e),
      contractorIds: getExpenseContractorIds(e),
      comment: e.comment,
      receiptPhoto: e.receiptPhoto,
    });
    setStep(0);
    setOpen(true);
  };

  const goNext = () => {
    if (step === 0 && form.estimateItemIds.length === 0) {
      toast.error('Выберите хотя бы одну позицию сметы');
      return;
    }
    if (step === 1 && totalFromPays <= 0) {
      toast.error('Укажите сумму хотя бы по одному способу оплаты');
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const toggleEstimate = (id: string) => {
    setForm((f) => {
      const nextIds = toggleId(f.estimateItemIds, id);
      const derived = deriveFromEstimateItems(nextIds, estimateItems);

      const prevAuto = autoCommentFromItems(f.estimateItemIds, estimateItems);
      const nextAuto = autoCommentFromItems(nextIds, estimateItems);
      const commentWasAuto =
        !f.comment.trim() || f.comment.trim() === prevAuto.trim();

      // Остаток к оплате по выбранным позициям
      const remainSum = nextIds.reduce((s, xid) => {
        const item = estimateItems.find((i) => i.id === xid);
        if (!item) return s;
        return s + itemRemaining(item, selectItemFact(expenses, xid, estimateItems));
      }, 0);

      // Автосумма, если оплату ещё не трогали или она совпадала с прошлым остатком
      const prevRemain = f.estimateItemIds.reduce((s, xid) => {
        const item = estimateItems.find((i) => i.id === xid);
        if (!item) return s;
        return s + itemRemaining(item, selectItemFact(expenses, xid, estimateItems));
      }, 0);
      const prevPartsTotal = paymentPartsTotal(formToPaymentParts(f));
      const amountWasAuto =
        prevPartsTotal === 0 ||
        Math.abs(prevPartsTotal - prevRemain) < 0.01;

      const payFields = amountWasAuto
        ? applyRemainingToCash(remainSum)
        : {
            payCash: f.payCash,
            payCard: f.payCard,
            payTransfer: f.payTransfer,
          };

      return {
        ...f,
        estimateItemIds: nextIds,
        zoneIds: derived.zoneIds,
        categoryIds: derived.categoryIds,
        stageIds: derived.stageIds,
        comment: commentWasAuto ? nextAuto : f.comment,
        ...payFields,
      };
    });
  };

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
    const paymentParts = formToPaymentParts(form);
    const amount = paymentPartsTotal(paymentParts);

    if (amount <= 0) {
      toast.error('Укажите сумму хотя бы по одному способу оплаты');
      return;
    }
    if (form.estimateItemIds.length === 0) {
      toast.error('Выберите хотя бы одну позицию сметы');
      return;
    }
    if (form.zoneIds.length === 0) {
      toast.error('У выбранных позиций нет зон — проверьте смету');
      return;
    }
    if (form.categoryIds.length === 0) {
      toast.error('У выбранных позиций нет категорий — проверьте смету');
      return;
    }
    if (form.stageIds.length === 0) {
      toast.error('У выбранных позиций нет этапов — проверьте смету');
      return;
    }

    const payload = {
      date: form.date || todayISO(),
      amount,
      paymentParts,
      paymentMethod: paymentParts[0].method,
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
                  {METHODS.map((k) => (
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
              ? 'Выберите позиции сметы — зоны, категории и этапы подтянутся сами. Можно разбить оплату: наличные + безнал + перевод.'
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
            const parts = getPaymentParts(e);
            return (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {formatBr(e.amount)}
                        </span>
                        {parts.map((p) => (
                          <Badge key={p.method} variant="secondary">
                            {PAYMENT_LABELS[p.method]} {formatBr(p.amount)}
                          </Badge>
                        ))}
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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setStep(0);
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать расход' : 'Новый расход'}
            </DialogTitle>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {(['Смета', 'Оплата', 'Детали'] as const).map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    'rounded-xl px-2 py-2 text-center text-xs font-medium transition',
                    step === i
                      ? 'bg-primary text-primary-foreground'
                      : i < step
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}. {label}
                </button>
              ))}
            </div>
          </DialogHeader>

          <DialogBody>
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Выберите позиции. Зоны, категории и этапы подтянутся сами.
                </p>
                <CheckList
                  maxHeightClass="max-h-[min(40dvh,280px)]"
                  items={estimateItems.map((i) => {
                    const fact = selectItemFact(expenses, i.id, estimateItems);
                    const remain = itemRemaining(i, fact);
                    return {
                      id: i.id,
                      title: i.name,
                      subtitle: `Остаток ${formatBr(remain)} · план ${formatBr(itemPlan(i))}`,
                    };
                  })}
                  selected={form.estimateItemIds}
                  onToggle={toggleEstimate}
                  emptyLabel="Сначала добавьте позиции в смету"
                />

                {linkedToEstimate && (
                  <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Из сметы
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {form.zoneIds.map((id) => {
                        const z = zones.find((x) => x.id === id);
                        return (
                          <Badge key={`z-${id}`} variant="outline">
                            {z && (
                              <span
                                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                                style={{ background: z.color }}
                              />
                            )}
                            {z?.name ?? id}
                          </Badge>
                        );
                      })}
                      {form.categoryIds.map((id) => {
                        const c = categories.find((x) => x.id === id);
                        return (
                          <Badge key={`c-${id}`} variant="secondary">
                            {c?.name ?? id}
                          </Badge>
                        );
                      })}
                      {form.stageIds.map((id) => {
                        const s = stages.find((x) => x.id === id);
                        return (
                          <Badge key={`s-${id}`} variant="secondary">
                            {s?.name ?? id}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      Остаток: {formatBr(selectedRemainingTotal)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Можно разбить: наличные + безнал + перевод. Аванс — меньше
                  остатка ({formatBr(selectedRemainingTotal)}).
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      ['payCash', 'Наличные'] as const,
                      ['payCard', 'Безнал'] as const,
                      ['payTransfer', 'Перевод'] as const,
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[1fr_minmax(0,7.5rem)_auto] items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5"
                    >
                      <span className="truncate text-sm font-medium">
                        {label}
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-10 min-w-0 text-right tabular-nums"
                        placeholder="0"
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                      <span className="text-sm text-muted-foreground">Br</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl bg-primary/10 px-4 py-3">
                  <span className="text-sm font-medium">Итого</span>
                  <span className="text-lg font-bold tabular-nums">
                    {formatBr(totalFromPays)}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={selectedRemainingTotal <= 0}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      ...applyRemainingToCash(selectedRemainingTotal),
                    }))
                  }
                >
                  Подставить остаток {formatBr(selectedRemainingTotal)}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label>Дата</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Контрагенты</Label>
                  <CheckList
                    maxHeightClass="max-h-36"
                    items={contractors.map((c) => ({
                      id: c.id,
                      title: c.name,
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
                    className="min-h-[72px]"
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                    placeholder="Что купили / кому заплатили"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Фото чека</Label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm font-medium hover:bg-muted">
                      <Camera className="h-4 w-4" />
                      {form.receiptPhoto ? 'Заменить' : 'Прикрепить'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(ev) =>
                          onPhoto(ev.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    {form.receiptPhoto && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setForm({ ...form, receiptPhoto: null })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {form.receiptPhoto && (
                    <img
                      src={form.receiptPhoto}
                      alt="Чек"
                      className="mx-auto max-h-28 rounded-2xl border object-contain"
                    />
                  )}
                </div>

                <div className="rounded-2xl bg-muted/40 p-3 text-sm">
                  <p className="font-semibold tabular-nums">
                    {formatBr(totalFromPays)}
                  </p>
                  <p className="mt-1 truncate text-muted-foreground">
                    {form.estimateItemIds.length} поз. · {form.date}
                    {form.comment ? ` · ${form.comment}` : ''}
                  </p>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="flex-row gap-2 sm:flex-row">
            {step > 0 ? (
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setStep((s) => s - 1)}
              >
                Назад
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
            )}
            {step < 2 ? (
              <Button className="flex-1 sm:flex-none" onClick={goNext}>
                Далее
              </Button>
            ) : (
              <Button className="flex-1 sm:flex-none" onClick={save}>
                Сохранить
              </Button>
            )}
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
