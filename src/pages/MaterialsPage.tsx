import { useMemo, useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { materialRemain, materialUsagePercent } from '../lib/materials';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { MaterialStock } from '../types';
import { UNITS } from '../types';

type FormState = {
  name: string;
  unit: string;
  qtyIn: string;
  qtyOut: string;
  zoneIds: string[];
  note: string;
};

const empty = (): FormState => ({
  name: '',
  unit: 'шт',
  qtyIn: '',
  qtyOut: '0',
  zoneIds: [],
  note: '',
});

export function MaterialsPage() {
  const materials = useAppStore((s) => s.materials ?? []);
  const zones = useAppStore((s) => s.zones);
  const project = useAppStore((s) => s.project);
  const add = useAppStore((s) => s.addMaterial);
  const update = useAppStore((s) => s.updateMaterial);
  const remove = useAppStore((s) => s.removeMaterial);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialStock | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterZone, setFilterZone] = useState('all');

  const activeZones = useMemo(() => {
    const active = new Set(project.activeZones);
    const list = zones.filter((z) => active.has(z.id));
    return list.length > 0 ? list : zones;
  }, [zones, project.activeZones]);

  const filtered = useMemo(() => {
    let list = [...materials];
    if (filterZone !== 'all') {
      list = list.filter((m) => m.zoneIds.includes(filterZone));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [materials, filterZone]);

  const lowStock = materials.filter((m) => {
    const r = materialRemain(m);
    return m.qtyIn > 0 && r <= m.qtyIn * 0.15;
  }).length;

  const openCreate = () => {
    setEditing(null);
    setForm(empty());
    setOpen(true);
  };

  const openEdit = (m: MaterialStock) => {
    setEditing(m);
    setForm({
      name: m.name,
      unit: m.unit,
      qtyIn: String(m.qtyIn),
      qtyOut: String(m.qtyOut),
      zoneIds: [...m.zoneIds],
      note: m.note,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Укажите название');
      return;
    }
    const payload = {
      name: form.name.trim(),
      unit: form.unit || 'шт',
      qtyIn: Math.max(0, Number(form.qtyIn) || 0),
      qtyOut: Math.max(0, Number(form.qtyOut) || 0),
      zoneIds: form.zoneIds,
      note: form.note.trim(),
    };
    if (payload.qtyOut > payload.qtyIn) {
      toast.error('Израсходовано не может быть больше куплено');
      return;
    }
    if (editing) {
      update(editing.id, payload);
      toast.success('Обновлено');
    } else {
      add(payload);
      toast.success('Материал добавлен');
    }
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Склад"
        subtitle="Единицы и остатки материалов на объекте"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      {materials.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Позиций</p>
              <p className="text-xl font-bold tabular-nums">{materials.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Мало осталось</p>
              <p
                className={cn(
                  'text-xl font-bold tabular-nums',
                  lowStock > 0 && 'text-amber-600 dark:text-amber-400',
                )}
              >
                {lowStock}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {materials.length > 0 && (
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="w-full sm:w-[200px]">
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
      )}

      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Склад пуст"
          description="Учитывайте закупку и расход: мешки, плитка, кабель — что осталось на объекте."
          actionLabel="Добавить материал"
          onAction={openCreate}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Ничего в этой зоне"
          description="Смените фильтр зоны."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const remain = materialRemain(m);
            const pct = materialUsagePercent(m);
            const low = m.qtyIn > 0 && remain <= m.qtyIn * 0.15;
            return (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{m.name}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Куплено {m.qtyIn} {m.unit} · ушло {m.qtyOut} {m.unit}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-base font-bold tabular-nums',
                          low && 'text-amber-600 dark:text-amber-400',
                        )}
                      >
                        Остаток: {remain} {m.unit}
                        {low && (
                          <Badge variant="warning" className="ml-2">
                            Мало
                          </Badge>
                        )}
                      </p>
                      {m.qtyIn > 0 && (
                        <div className="mt-2 max-w-xs">
                          <Progress value={pct} className="h-1.5" />
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            израсходовано {pct}%
                          </p>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.zoneIds.map((zid) => {
                          const z = zones.find((x) => x.id === zid);
                          if (!z) return null;
                          return (
                            <Badge key={zid} variant="outline" className="gap-1">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: z.color }}
                              />
                              {z.name}
                            </Badge>
                          );
                        })}
                      </div>
                      {m.note && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {m.note}
                        </p>
                      )}
                      <div className="mt-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            update(m.id, {
                              qtyOut: Math.min(m.qtyIn, m.qtyOut + 1),
                            })
                          }
                        >
                          −1 {m.unit}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            update(m.id, { qtyIn: m.qtyIn + 1 })
                          }
                        >
                          +1 купил
                        </Button>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteId(m.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать' : 'Новый материал'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Название</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Клей для плитки, кабель 3×2.5…"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1.5">
                <Label>Куплено</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.qtyIn}
                  onChange={(e) => setForm({ ...form, qtyIn: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Ушло</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.qtyOut}
                  onChange={(e) => setForm({ ...form, qtyOut: e.target.value })}
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
              <Label>Заметка</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={save}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Удалить материал?"
        description="Запись со склада будет удалена."
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
