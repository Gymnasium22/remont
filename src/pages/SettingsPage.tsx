import { useRef, useState } from 'react';
import {
  Download,
  Layers,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Upload,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { downloadJson } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { AppData, ThemeMode } from '../types';
import { cn } from '../lib/utils';

const COLORS = [
  '#0ea5e9',
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#ef4444',
  '#3b82f6',
  '#64748b',
];

export function SettingsPage() {
  const project = useAppStore((s) => s.project);
  const zones = useAppStore((s) => s.zones);
  const categories = useAppStore((s) => s.categories);
  const stages = useAppStore((s) => s.stages);
  const theme = useAppStore((s) => s.settings.theme);
  const updateProject = useAppStore((s) => s.updateProject);
  const toggleActiveZone = useAppStore((s) => s.toggleActiveZone);
  const addZone = useAppStore((s) => s.addZone);
  const removeZone = useAppStore((s) => s.removeZone);
  const addCategory = useAppStore((s) => s.addCategory);
  const removeCategory = useAppStore((s) => s.removeCategory);
  const addStage = useAppStore((s) => s.addStage);
  const removeStage = useAppStore((s) => s.removeStage);
  const setTheme = useAppStore((s) => s.setTheme);
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const resetAll = useAppStore((s) => s.resetAll);

  const [newZone, setNewZone] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newStage, setNewStage] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const data = exportData();
    const name = (project.name || 'moy-remont')
      .replace(/[^\wа-яё\- ]/gi, '')
      .trim()
      .replace(/\s+/g, '-');
    downloadJson(data, `${name || 'moy-remont'}-backup.json`);
    toast.success('Данные экспортированы');
  };

  const onPickImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppData;
      if (!data || data.version !== 1) {
        toast.error('Неверный формат JSON (ожидается version: 1)');
        return;
      }
      setPendingImport(data);
      setImportOpen(true);
    } catch {
      toast.error('Не удалось прочитать файл');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Настройки"
        subtitle="Проект, справочники, тема и данные"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Проект ремонта</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Название</Label>
            <Input
              value={project.name}
              onChange={(e) => updateProject({ name: e.target.value })}
              placeholder="Квартира на Независимости"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Дата начала</Label>
              <Input
                type="date"
                value={project.startDate}
                onChange={(e) => updateProject({ startDate: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Бюджет, Br</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={project.totalBudget || ''}
                onChange={(e) =>
                  updateProject({ totalBudget: Number(e.target.value) || 0 })
                }
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Активные зоны ремонта
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Отметьте комнаты, которые сейчас в работе — они видны на дашборде.
          </p>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => {
              const active = project.activeZones.includes(z.id);
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => toggleActiveZone(z.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: z.color }}
                  />
                  {z.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Зоны (комнаты)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {zones.map((z) => (
              <li
                key={z.id}
                className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: z.color }}
                  />
                  {z.name}
                </span>
                {z.isCustom && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeZone(z.id)}
                  >
                    Удалить
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Новая зона"
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!newZone.trim()) return;
                addZone(
                  newZone.trim(),
                  COLORS[zones.length % COLORS.length],
                );
                setNewZone('');
                toast.success('Зона добавлена');
              }}
            >
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Категории</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
                {c.isCustom && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeCategory(c.id)}
                  >
                    Удалить
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Новая категория"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!newCat.trim()) return;
                addCategory(
                  newCat.trim(),
                  COLORS[categories.length % COLORS.length],
                );
                setNewCat('');
                toast.success('Категория добавлена');
              }}
            >
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Этапы ремонта</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {[...stages]
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {s.order}. {s.name}
                  </span>
                  {s.isCustom && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeStage(s.id)}
                    >
                      Удалить
                    </Button>
                  )}
                </li>
              ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Новый этап"
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!newStage.trim()) return;
                addStage(newStage.trim());
                setNewStage('');
                toast.success('Этап добавлен');
              }}
            >
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Тема оформления
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'light', label: 'Светлая', icon: Sun },
                { id: 'dark', label: 'Тёмная', icon: Moon },
                { id: 'system', label: 'Системная', icon: Monitor },
              ] as { id: ThemeMode; label: string; icon: typeof Sun }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm font-medium transition',
                  theme === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Данные</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4" />
            Экспорт JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Импорт JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void onPickImport(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <Button
            variant="destructive"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Сбросить всё
          </Button>
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        МойРемонт · локальные данные в IndexedDB · суммы в Br (BYN)
      </p>

      <ConfirmDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Импортировать данные?"
        description="Текущие данные будут полностью перезаписаны содержимым файла. Это действие нельзя отменить."
        confirmLabel="Импортировать"
        destructive
        onConfirm={async () => {
          if (!pendingImport) return;
          try {
            await importData(pendingImport);
            toast.success('Данные импортированы');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Ошибка импорта');
          }
          setPendingImport(null);
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Сбросить все данные?"
        description="Смета, расходы, контрагенты и настройки проекта будут удалены. Справочники вернутся к значениям по умолчанию."
        confirmLabel="Сбросить"
        onConfirm={async () => {
          await resetAll();
          toast.success('Данные сброшены');
        }}
      />
    </div>
  );
}
