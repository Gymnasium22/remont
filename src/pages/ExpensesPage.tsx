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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { formatBr } from '../lib/currency';
import { compressImage, formatDate } from '../lib/utils';
import { getItemZoneIds } from '../lib/zones';
import { todayISO, useAppStore } from '../store/useAppStore';
import type { Expense, PaymentMethod } from '../types';
import { PAYMENT_LABELS } from '../types';

type FormState = {
  date: string;
  amount: string;
  paymentMethod: PaymentMethod;
  estimateItemId: string;
  zoneId: string;
  categoryId: string;
  stageId: string;
  contractorId: string;
  comment: string;
  receiptPhoto: string | null;
};

function emptyForm(
  zones: { id: string }[],
  cats: { id: string }[],
  stages: { id: string }[],
): FormState {
  return {
    date: todayISO(),
    amount: '',
    paymentMethod: 'cash',
    estimateItemId: 'none',
    zoneId: zones[0]?.id ?? '',
    categoryId: cats[0]?.id ?? '',
    stageId: stages[0]?.id ?? '',
    contractorId: 'none',
    comment: '',
    receiptPhoto: null,
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
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(zones, categories, stages),
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (filterZone !== 'all' && e.zoneId !== filterZone) return false;
        if (filterCat !== 'all' && e.categoryId !== filterCat) return false;
        if (filterPay !== 'all' && e.paymentMethod !== filterPay) return false;
        if (filterContractor !== 'all') {
          if (filterContractor === 'none' && e.contractorId) return false;
          if (filterContractor !== 'none' && e.contractorId !== filterContractor)
            return false;
        }
        if (dateFrom && e.date < dateFrom) return false;
        if (dateTo && e.date > dateTo) return false;
        if (q) {
          const item = estimateItems.find((i) => i.id === e.estimateItemId);
          const hay = `${e.comment} ${item?.name ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
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
      estimateItemId: e.estimateItemId ?? 'none',
      zoneId: e.zoneId,
      categoryId: e.categoryId,
      stageId: e.stageId,
      contractorId: e.contractorId ?? 'none',
      comment: e.comment,
      receiptPhoto: e.receiptPhoto,
    });
    setOpen(true);
  };

  const onPickEstimate = (id: string) => {
    if (id === 'none') {
      setForm((f) => ({ ...f, estimateItemId: 'none' }));
      return;
    }
    const item = estimateItems.find((i) => i.id === id);
    if (!item) return;
    const zids = getItemZoneIds(item);
    setForm((f) => ({
      ...f,
      estimateItemId: id,
      zoneId: zids[0] ?? f.zoneId,
      categoryId: item.categoryId,
      stageId: item.stageId,
      comment: f.comment || item.name,
    }));
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
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Укажите сумму расхода');
      return;
    }
    const payload = {
      date: form.date || todayISO(),
      amount,
      paymentMethod: form.paymentMethod,
      estimateItemId:
        form.estimateItemId === 'none' ? null : form.estimateItemId,
      zoneId: form.zoneId,
      categoryId: form.categoryId,
      stageId: form.stageId,
      contractorId:
        form.contractorId === 'none' ? null : form.contractorId,
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
          title={expenses.length === 0 ? 'Расходов пока нет' : 'Ничего не найдено'}
          description={
            expenses.length === 0
              ? 'Фиксируйте фактические траты: наличные, безнал, переводы. Можно прикрепить фото чека.'
              : 'Смягчите фильтры или измените период.'
          }
          actionLabel={expenses.length === 0 ? 'Добавить расход' : undefined}
          onAction={expenses.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const zone = zones.find((z) => z.id === e.zoneId);
            const cat = categories.find((c) => c.id === e.categoryId);
            const contractor = contractors.find((c) => c.id === e.contractorId);
            const item = estimateItems.find((i) => i.id === e.estimateItemId);
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
                        {zone && (
                          <Badge variant="outline">
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full"
                              style={{ background: zone.color }}
                            />
                            {zone.name}
                          </Badge>
                        )}
                        {cat && <Badge variant="secondary">{cat.name}</Badge>}
                        {item && (
                          <Badge variant="default">Смета: {item.name}</Badge>
                        )}
                        {contractor && (
                          <Badge variant="outline">{contractor.name}</Badge>
                        )}
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
              <Label>Позиция сметы (необязательно)</Label>
              <Select
                value={form.estimateItemId}
                onValueChange={onPickEstimate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Свободная запись" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без привязки</SelectItem>
                  {estimateItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Зона</Label>
                <Select
                  value={form.zoneId}
                  onValueChange={(v) => setForm({ ...form, zoneId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Этап</Label>
                <Select
                  value={form.stageId}
                  onValueChange={(v) => setForm({ ...form, stageId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Контрагент</Label>
                <Select
                  value={form.contractorId}
                  onValueChange={(v) => setForm({ ...form, contractorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не указан</SelectItem>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
