import { useMemo, useState } from 'react';
import { Camera, ImageIcon, Trash2 } from 'lucide-react';
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
import { compressImage, cn, formatDate, todayISO } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { ZonePhoto, ZonePhotoKind } from '../types';
import { ZONE_PHOTO_KIND_LABELS } from '../types';

const KINDS: ZonePhotoKind[] = ['before', 'process', 'after'];

export function PhotosPage() {
  const zones = useAppStore((s) => s.zones);
  const project = useAppStore((s) => s.project);
  const photos = useAppStore((s) => s.zonePhotos ?? []);
  const add = useAppStore((s) => s.addZonePhoto);
  const remove = useAppStore((s) => s.removeZonePhoto);

  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [uploadZone, setUploadZone] = useState('');
  const [uploadKind, setUploadKind] = useState<ZonePhotoKind>('process');
  const [caption, setCaption] = useState('');
  const [gallery, setGallery] = useState<ZonePhoto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeZones = useMemo(() => {
    const active = new Set(project.activeZones);
    const list = zones.filter((z) => active.has(z.id));
    return list.length > 0 ? list : zones;
  }, [zones, project.activeZones]);

  const filtered = useMemo(() => {
    return photos
      .filter((p) => {
        if (zoneFilter !== 'all' && p.zoneId !== zoneFilter) return false;
        if (kindFilter !== 'all' && p.kind !== kindFilter) return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.takenAt.localeCompare(a.takenAt) ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }, [photos, zoneFilter, kindFilter]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const zoneId = uploadZone || activeZones[0]?.id || zones[0]?.id;
    if (!zoneId) {
      toast.error('Сначала добавьте зону в настройках');
      return;
    }
    try {
      const list = Array.from(files).slice(0, 6);
      for (const f of list) {
        const dataUrl = await compressImage(f, 1400, 0.75);
        add({
          zoneId,
          kind: uploadKind,
          dataUrl,
          caption: caption.trim(),
          takenAt: todayISO(),
        });
      }
      toast.success(
        list.length === 1 ? 'Фото добавлено' : `Добавлено: ${list.length}`,
      );
      setCaption('');
    } catch {
      toast.error('Не удалось обработать фото');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Фото зон"
        subtitle="До · процесс · после — по комнатам"
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">Загрузить</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Зона</Label>
              <Select
                value={uploadZone || activeZones[0]?.id || ''}
                onValueChange={setUploadZone}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Зона" />
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
              <Label>Тип</Label>
              <Select
                value={uploadKind}
                onValueChange={(v) => setUploadKind(v as ZonePhotoKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ZONE_PHOTO_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Подпись</Label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Опционально"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition hover:bg-muted/50">
            <Camera className="h-5 w-5" />
            Выбрать фото
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
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
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['all', 'Все'],
              ...KINDS.map((k) => [k, ZONE_PHOTO_KIND_LABELS[k]] as const),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKindFilter(id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition',
                kindFilter === id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Пока нет фото"
          description="Снимайте ход работ по зонам — удобно спорить с бригадой и смотреть прогресс."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Нет фото по фильтру"
          description="Смените зону или тип."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => {
            const zone = zones.find((z) => z.id === p.zoneId);
            return (
              <button
                key={p.id}
                type="button"
                className="group overflow-hidden rounded-2xl border border-border text-left"
                onClick={() => setGallery(p)}
              >
                <div className="aspect-[4/3] bg-muted">
                  <img
                    src={p.dataUrl}
                    alt={p.caption || zone?.name || 'Фото'}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                </div>
                <div className="space-y-1 p-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">
                      {ZONE_PHOTO_KIND_LABELS[p.kind]}
                    </Badge>
                    {zone && (
                      <Badge variant="outline" className="gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: zone.color }}
                        />
                        {zone.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(p.takenAt)}
                    {p.caption ? ` · ${p.caption}` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!gallery} onOpenChange={(o) => !o && setGallery(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {gallery &&
                (zones.find((z) => z.id === gallery.zoneId)?.name ?? 'Фото')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {gallery && (
              <>
                <img
                  src={gallery.dataUrl}
                  alt=""
                  className="max-h-[60dvh] w-full rounded-xl object-contain"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    {ZONE_PHOTO_KIND_LABELS[gallery.kind]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(gallery.takenAt)}
                  </span>
                  {gallery.caption && (
                    <p className="w-full text-sm">{gallery.caption}</p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteId(gallery.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Удалить фото?"
        description="Фото будет удалено с устройства."
        onConfirm={() => {
          if (deleteId) {
            remove(deleteId);
            setGallery(null);
            setDeleteId(null);
            toast.success('Удалено');
          }
        }}
      />
    </div>
  );
}
