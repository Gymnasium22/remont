import { useState } from 'react';
import { ExternalLink, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
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
import { Textarea } from '../components/ui/textarea';
import { formatBr } from '../lib/currency';
import { getExpenseContractorIds } from '../lib/expense';
import { useAppStore } from '../store/useAppStore';
import type { Contractor } from '../types';

type FormState = {
  name: string;
  phone: string;
  telegram: string;
  note: string;
};

const empty: FormState = { name: '', phone: '', telegram: '', note: '' };

function telegramHref(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http')) return v;
  const user = v.replace(/^@/, '');
  return `https://t.me/${user}`;
}

export function ContractorsPage() {
  const contractors = useAppStore((s) => s.contractors);
  const expenses = useAppStore((s) => s.expenses);
  const add = useAppStore((s) => s.addContractor);
  const update = useAppStore((s) => s.updateContractor);
  const remove = useAppStore((s) => s.removeContractor);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (c: Contractor) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      telegram: c.telegram,
      note: c.note,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Укажите название / имя');
      return;
    }
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      telegram: form.telegram.trim(),
      note: form.note.trim(),
    };
    if (editing) {
      update(editing.id, payload);
      toast.success('Контрагент обновлён');
    } else {
      add(payload);
      toast.success('Контрагент добавлен');
    }
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Контрагенты"
        subtitle="Мастера, магазины, бригады"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      {contractors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Список пуст"
          description="Добавьте контакты исполнителей и поставщиков — потом привязывайте к ним расходы."
          actionLabel="Добавить контрагента"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {contractors.map((c) => {
            const spent = expenses
              .filter((e) => getExpenseContractorIds(e).includes(c.id))
              .reduce((s, e) => {
                const n = getExpenseContractorIds(e).length || 1;
                return s + e.amount / n;
              }, 0);
            const tg = telegramHref(c.telegram);
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{c.name}</h3>
                      {spent > 0 && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Расходы: {formatBr(spent)}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1.5 text-primary"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {c.phone}
                          </a>
                        )}
                        {tg && (
                          <a
                            href={tg}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {c.telegram || 'Telegram'}
                          </a>
                        )}
                      </div>
                      {c.note && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {c.note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteId(c.id)}
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
              {editing ? 'Редактировать' : 'Новый контрагент'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Название / имя</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ИП Иванов / Магазин Плитка"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Телефон</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+375 XX XXX-XX-XX"
                type="tel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Telegram</Label>
              <Input
                value={form.telegram}
                onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                placeholder="@username или ссылка"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Примечание</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Специализация, условия…"
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
        title="Удалить контрагента?"
        description="Контрагент будет удалён. Привязка расходов сбросится."
        onConfirm={() => {
          if (deleteId) {
            remove(deleteId);
            toast.success('Контрагент удалён');
          }
        }}
      />
    </div>
  );
}
