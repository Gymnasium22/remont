import { useMemo, useState } from 'react';
import {
  Check,
  ClipboardList,
  Copy,
  GitMerge,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
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
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { formatBr } from '../lib/currency';
import { cn } from '../lib/utils';
import { uid } from '../lib/utils';
import {
  formatZoneNames,
  getItemExtras,
  getItemZoneIds,
  itemDiyEconomy,
  itemExpectedPaid,
  itemExtrasPlan,
  itemHasZone,
  itemPlan,
  itemRemaining,
} from '../lib/zones';
import { selectItemFact, useAppStore } from '../store/useAppStore';
import type { EstimateExtra, EstimateItem } from '../types';
import { UNITS } from '../types';

type ExtraForm = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type FormState = {
  name: string;
  zoneIds: string[];
  categoryId: string;
  stageId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  progress: string;
  selfDonePercent: string;
  extras: ExtraForm[];
  note: string;
};

const emptyForm = (
  zones: { id: string }[],
  cats: { id: string; name: string }[],
  stages: { id: string; name: string }[],
): FormState => {
  const works =
    cats.find((c) => /работ/i.test(c.name))?.id ?? cats[0]?.id ?? '';
  const stage =
    stages.find((s) => /чернов/i.test(s.name))?.id ?? stages[0]?.id ?? '';
  return {
    name: '',
    zoneIds: zones[0]?.id ? [zones[0].id] : [],
    categoryId: works,
    stageId: stage,
    quantity: '1',
    unit: 'шт',
    unitPrice: '',
    progress: '0',
    selfDonePercent: '0',
    extras: [],
    note: '',
  };
};

function emptyExtra(): ExtraForm {
  return {
    id: uid(),
    name: '',
    quantity: '1',
    unit: 'шт',
    unitPrice: '',
  };
}

function extrasFromForm(extras: ExtraForm[]): EstimateExtra[] {
  return extras
    .filter((e) => e.name.trim())
    .map((e) => ({
      id: e.id || uid(),
      name: e.name.trim(),
      quantity: Number(e.quantity) || 0,
      unit: e.unit || 'шт',
      unitPrice: Number(e.unitPrice) || 0,
    }));
}

function ZoneChips({
  zones,
  selected,
  onToggle,
}: {
  zones: { id: string; name: string; color: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {zones.map((z) => {
        const on = selected.includes(z.id);
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => onToggle(z.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition',
              on
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: z.color }}
            />
            {z.name}
            {on && <Check className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

export function EstimatePage() {
  const zones = useAppStore((s) => s.zones);
  const categories = useAppStore((s) => s.categories);
  const stages = useAppStore((s) => s.stages);
  const items = useAppStore((s) => s.estimateItems);
  const expenses = useAppStore((s) => s.expenses);
  const add = useAppStore((s) => s.addEstimateItem);
  const update = useAppStore((s) => s.updateEstimateItem);
  const remove = useAppStore((s) => s.removeEstimateItem);
  const duplicate = useAppStore((s) => s.duplicateEstimateItem);
  const mergeZones = useAppStore((s) => s.mergeZones);

  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateItem | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(zones, categories, stages),
  );
  /** 0 — основа, 1 — допработы, 2 — прогресс */
  const [estStep, setEstStep] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => {
        if (filterZone !== 'all' && !itemHasZone(i, filterZone)) return false;
        if (!q) return true;
        return (
          i.name.toLowerCase().includes(q) ||
          (i.note ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [items, search, filterZone]);

  const totalPlan = items.reduce((s, i) => s + itemPlan(i), 0);

  const toggleFormZone = (id: string) => {
    setForm((f) => {
      const has = f.zoneIds.includes(id);
      if (has) {
        if (f.zoneIds.length === 1) return f;
        return { ...f, zoneIds: f.zoneIds.filter((z) => z !== id) };
      }
      return { ...f, zoneIds: [...f.zoneIds, id] };
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(zones, categories, stages));
    setEstStep(0);
    setOpen(true);
  };

  const openEdit = (item: EstimateItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      zoneIds: getItemZoneIds(item),
      categoryId: item.categoryId,
      stageId: item.stageId,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      progress: String(item.progress),
      selfDonePercent: String(item.selfDonePercent ?? 0),
      extras: getItemExtras(item).map((e) => ({
        id: e.id,
        name: e.name,
        quantity: String(e.quantity),
        unit: e.unit,
        unitPrice: String(e.unitPrice),
      })),
      note: item.note ?? '',
    });
    setEstStep(0);
    setOpen(true);
  };

  const goEstNext = () => {
    if (estStep === 0) {
      if (!form.name.trim()) {
        toast.error('Укажите название позиции');
        return;
      }
      if (form.zoneIds.length === 0) {
        toast.error('Выберите хотя бы одну зону');
        return;
      }
    }
    setEstStep((s) => Math.min(2, s + 1));
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Укажите название позиции');
      return;
    }
    if (form.zoneIds.length === 0) {
      toast.error('Выберите хотя бы одну зону');
      return;
    }
    const selfDonePercent = Math.min(
      100,
      Math.max(0, Number(form.selfDonePercent) || 0),
    );
    let progress = Math.min(100, Math.max(0, Number(form.progress) || 0));
    // Если своими силами больше, чем отмеченный прогресс — подтягиваем прогресс
    if (selfDonePercent > progress) progress = selfDonePercent;
    const extras = extrasFromForm(form.extras);
    const payload = {
      name: form.name.trim(),
      zoneIds: form.zoneIds,
      zoneId: form.zoneIds[0],
      categoryId: form.categoryId,
      stageId: form.stageId,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      unitPrice: Number(form.unitPrice) || 0,
      progress,
      selfDonePercent,
      extras,
      note: form.note.trim() || undefined,
    };
    if (editing) {
      update(editing.id, payload);
      toast.success('Позиция обновлена');
    } else {
      add(payload);
      toast.success('Позиция добавлена в смету');
    }
    setOpen(false);
  };

  const openMerge = () => {
    setMergeSelected([]);
    setMergeName('');
    setMergeOpen(true);
  };

  const toggleMergeZone = (id: string) => {
    setMergeSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      const names = next
        .map((zid) => zones.find((z) => z.id === zid)?.name)
        .filter(Boolean);
      // Автоимя из выбранных зон (если пользователь не задал своё без «+»)
      setMergeName((cur) => {
        if (!cur.trim() || cur.includes(' + ')) return names.join(' + ');
        return cur;
      });
      return next;
    });
  };

  const doMerge = () => {
    if (mergeSelected.length < 2) {
      toast.error('Выберите минимум две зоны');
      return;
    }
    const id = mergeZones(mergeSelected, mergeName);
    if (!id) {
      toast.error('Не удалось объединить зоны');
      return;
    }
    toast.success('Зоны объединены');
    setMergeOpen(false);
    if (filterZone !== 'all' && mergeSelected.includes(filterZone)) {
      setFilterZone(id);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Смета"
        subtitle={`План: ${formatBr(totalPlan)} · ${items.length} поз.`}
        action={
          <div className="flex gap-2">
            <Button onClick={openMerge} size="sm" variant="outline">
              <GitMerge className="h-4 w-4" />
              <span className="hidden sm:inline">Объединить зоны</span>
            </Button>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Поиск по смете…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="sm:w-48">
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={items.length === 0 ? 'Смета пуста' : 'Ничего не найдено'}
          description={
            items.length === 0
              ? 'Добавьте плановые позиции. Одну позицию можно привязать сразу к нескольким зонам.'
              : 'Попробуйте изменить фильтр или запрос.'
          }
          actionLabel={items.length === 0 ? 'Добавить позицию' : undefined}
          onAction={items.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const zoneIds = getItemZoneIds(item);
            const itemZones = zoneIds
              .map((id) => zones.find((z) => z.id === id))
              .filter(Boolean) as typeof zones;
            const cat = categories.find((c) => c.id === item.categoryId);
            const stage = stages.find((s) => s.id === item.stageId);
            const plan = itemPlan(item);
            const extrasPlan = itemExtrasPlan(item);
            const diy = itemDiyEconomy(item);
            const expected = itemExpectedPaid(item);
            const fact = selectItemFact(expenses, item.id, items);
            const remain = itemRemaining(item, fact);
            const over = fact > expected && expected >= 0 && plan > 0;
            const selfPct = item.selfDonePercent ?? 0;
            const extras = getItemExtras(item);
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug">{item.name}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {itemZones.map((zone) => (
                          <Badge key={zone.id} variant="outline">
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full"
                              style={{ background: zone.color }}
                            />
                            {zone.name}
                          </Badge>
                        ))}
                        {zoneIds.length > 1 && (
                          <Badge variant="default">
                            {zoneIds.length} зоны
                          </Badge>
                        )}
                        {cat && <Badge variant="secondary">{cat.name}</Badge>}
                        {stage && <Badge variant="secondary">{stage.name}</Badge>}
                        {extras.length > 0 && (
                          <Badge variant="warning">
                            +{extras.length} допработ
                          </Badge>
                        )}
                        {selfPct > 0 && (
                          <Badge variant="success">
                            Своими силами {selfPct}%
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.quantity} {item.unit} × {formatBr(item.unitPrice)}
                        {extrasPlan > 0 && (
                          <> + допы {formatBr(extrasPlan)}</>
                        )}{' '}
                        ={' '}
                        <span className="font-semibold text-foreground">
                          {formatBr(plan)}
                        </span>
                        {diy > 0 && (
                          <>
                            {' '}
                            · экономия{' '}
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {formatBr(diy)}
                            </span>
                          </>
                        )}
                        {' '}
                        · оплачено{' '}
                        <span
                          className={over ? 'font-medium text-red-500' : ''}
                        >
                          {formatBr(fact)}
                        </span>
                        {' '}
                        · остаток{' '}
                        <span className="font-medium text-foreground">
                          {formatBr(remain)}
                        </span>
                      </p>
                      {extras.length > 0 && (
                        <ul className="mt-2 space-y-1 rounded-2xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {extras.map((ex) => (
                            <li
                              key={ex.id}
                              className="flex justify-between gap-2"
                            >
                              <span className="truncate">
                                {ex.name} · {ex.quantity} {ex.unit} ×{' '}
                                {formatBr(ex.unitPrice)}
                              </span>
                              <span className="shrink-0 font-medium text-foreground">
                                {formatBr(ex.quantity * ex.unitPrice)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>Выполнение</span>
                          <span>{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(item)}
                        title="Изменить"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          duplicate(item.id);
                          toast.success('Позиция продублирована');
                        }}
                        title="Дублировать"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteId(item.id)}
                        title="Удалить"
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

      {/* Форма позиции — 3 шага */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEstStep(0);
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать позицию' : 'Новая позиция сметы'}
            </DialogTitle>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {(['Основа', 'Допы', 'Прогресс'] as const).map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setEstStep(i)}
                  className={cn(
                    'rounded-xl px-2 py-2 text-center text-xs font-medium transition',
                    estStep === i
                      ? 'bg-primary text-primary-foreground'
                      : i < estStep
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
            {estStep === 0 && (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Название</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Например: Демонтаж ванной"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Зоны</Label>
                  <ZoneChips
                    zones={zones}
                    selected={form.zoneIds}
                    onToggle={toggleFormZone}
                  />
                  {form.zoneIds.length > 1 && (
                    <p className="text-xs text-primary">
                      {formatZoneNames(form.zoneIds, zones)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Категория</Label>
                    <Select
                      value={form.categoryId}
                      onValueChange={(v) =>
                        setForm({ ...form, categoryId: v })
                      }
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
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Кол-во</Label>
                    <Input
                      type="number"
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
                  <div className="grid gap-1.5">
                    <Label>Цена, Br</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={form.unitPrice}
                      onChange={(e) =>
                        setForm({ ...form, unitPrice: e.target.value })
                      }
                    />
                  </div>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  База:{' '}
                  {formatBr(
                    (Number(form.quantity) || 0) *
                      (Number(form.unitPrice) || 0),
                  )}
                </p>
              </div>
            )}

            {estStep === 1 && (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  Допработы по ходу: мешки, вынос, вывоз. Увеличивают план.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    setForm({
                      ...form,
                      extras: [...form.extras, emptyExtra()],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Добавить допработу
                </Button>
                {form.extras.length === 0 ? (
                  <p className="rounded-2xl bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
                    Пока нет допработ — можно пропустить
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.extras.map((ex, idx) => (
                      <div
                        key={ex.id}
                        className="grid gap-2 rounded-2xl border border-border bg-card p-3"
                      >
                        <div className="flex items-start gap-2">
                          <Input
                            className="min-w-0 flex-1"
                            placeholder="Мешки, вывоз…"
                            value={ex.name}
                            onChange={(e) => {
                              const extras = [...form.extras];
                              extras[idx] = { ...ex, name: e.target.value };
                              setForm({ ...form, extras });
                            }}
                          />
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="shrink-0 text-destructive"
                            onClick={() =>
                              setForm({
                                ...form,
                                extras: form.extras.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="Кол-во"
                            value={ex.quantity}
                            onChange={(e) => {
                              const extras = [...form.extras];
                              extras[idx] = {
                                ...ex,
                                quantity: e.target.value,
                              };
                              setForm({ ...form, extras });
                            }}
                          />
                          <Select
                            value={ex.unit}
                            onValueChange={(v) => {
                              const extras = [...form.extras];
                              extras[idx] = { ...ex, unit: v };
                              setForm({ ...form, extras });
                            }}
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
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="Цена"
                            value={ex.unitPrice}
                            onChange={(e) => {
                              const extras = [...form.extras];
                              extras[idx] = {
                                ...ex,
                                unitPrice: e.target.value,
                              };
                              setForm({ ...form, extras });
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ={' '}
                          {formatBr(
                            (Number(ex.quantity) || 0) *
                              (Number(ex.unitPrice) || 0),
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm font-medium tabular-nums">
                  План с допами:{' '}
                  {formatBr(
                    (Number(form.quantity) || 0) *
                      (Number(form.unitPrice) || 0) +
                      extrasFromForm(form.extras).reduce(
                        (s, e) => s + e.quantity * e.unitPrice,
                        0,
                      ),
                  )}
                </p>
              </div>
            )}

            {estStep === 2 && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Выполнение, %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.progress}
                      onChange={(e) =>
                        setForm({ ...form, progress: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Своими силами, %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.selfDonePercent}
                      onChange={(e) =>
                        setForm({ ...form, selfDonePercent: e.target.value })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  «Своими силами» — экономия: не платите наёмным за эту долю.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        ...form,
                        selfDonePercent: '100',
                        progress: '100',
                      })
                    }
                  >
                    Полностью сами
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ ...form, selfDonePercent: '0' })}
                  >
                    Сбросить DIY
                  </Button>
                </div>
                <div className="grid gap-1.5">
                  <Label>Заметка</Label>
                  <Textarea
                    className="min-h-[72px]"
                    value={form.note}
                    onChange={(e) =>
                      setForm({ ...form, note: e.target.value })
                    }
                    placeholder="Необязательно"
                  />
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="flex-row gap-2 sm:flex-row">
            {estStep > 0 ? (
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setEstStep((s) => s - 1)}
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
            {estStep < 2 ? (
              <Button className="flex-1 sm:flex-none" onClick={goEstNext}>
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

      {/* Объединение зон как сущностей */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Объединить зоны</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Выберите зоны, которые нужно слить в одну. Позиции сметы и расходы
              переедут в новую зону, старые зоны будут удалены.
            </p>
            <div className="grid gap-1.5">
              <Label>Зоны для объединения</Label>
              <ZoneChips
                zones={zones}
                selected={mergeSelected}
                onToggle={toggleMergeZone}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Название новой зоны</Label>
              <Input
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                placeholder="Например: Санузел"
              />
            </div>
            {mergeSelected.length >= 2 && (
              <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Будет создана зона «{mergeName || '…'}», позиции и расходы из{' '}
                {mergeSelected.length} зон переназначены. Активность на
                дашборде сохранится, если хотя бы одна из зон была в работе.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={doMerge}
              disabled={mergeSelected.length < 2}
            >
              <GitMerge className="h-4 w-4" />
              Объединить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Удалить позицию?"
        description="Позиция будет удалена из сметы. Связанные расходы останутся, но без привязки."
        onConfirm={() => {
          if (deleteId) {
            remove(deleteId);
            toast.success('Позиция удалена');
          }
        }}
      />
    </div>
  );
}
