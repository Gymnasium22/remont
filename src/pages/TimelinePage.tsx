import { CalendarDays, CircleCheck, Clock3, ListTree } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { formatBr } from '../lib/currency';
import { byStage } from '../lib/insights';
import { useAppStore } from '../store/useAppStore';

export function TimelinePage() {
  const stages = useAppStore((s) => s.stages);
  const estimateItems = useAppStore((s) => s.estimateItems);
  const rows = byStage(stages, estimateItems);
  const current = rows.find((row) => row.progress < 100) ?? rows.at(-1);

  return <div className="space-y-5">
    <PageHeader title="План-график" subtitle="Этапы выстроены по порядку работ и обновляются из сметы" action={<Button asChild size="sm"><Link to="/estimate">Открыть смету</Link></Button>} />
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><CalendarDays /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold">{current ? `Сейчас: ${current.stage.name}` : 'Добавьте позиции в смету'}</p><p className="text-sm text-muted-foreground">График считает готовность по стоимости работ — крупные этапы влияют честнее.</p></div>
        {current && <Badge variant={current.progress >= 100 ? 'success' : 'default'}>{Math.round(current.progress)}% готово</Badge>}
      </CardContent>
    </Card>
    {rows.length === 0 ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Когда появятся позиции сметы, здесь автоматически соберётся график работ.</CardContent></Card> : <div className="space-y-3">{rows.map((row, index) => {
      const done = row.progress >= 99.99; const active = row.stage.id === current?.stage.id;
      return <Card key={row.stage.id} className={active ? 'border-primary/40 shadow-md shadow-primary/5' : ''}><CardContent className="p-4 sm:p-5"><div className="flex gap-3"><div className="flex flex-col items-center"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{done ? <CircleCheck className="h-5 w-5" /> : index + 1}</span>{index < rows.length - 1 && <span className="mt-1 h-7 w-px bg-border" />}</div><div className="min-w-0 flex-1 pb-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{row.stage.name}</h2><p className="text-xs text-muted-foreground">{row.items.length} поз. · {formatBr(row.plan)}</p></div>{active && <Badge variant="default"><Clock3 className="mr-1 h-3 w-3" />в работе</Badge>}{done && <Badge variant="success">готово</Badge>}</div><div className="mt-3 flex items-center gap-3"><Progress value={row.progress} className="h-2 flex-1" /><span className="w-10 text-right text-sm font-semibold tabular-nums">{Math.round(row.progress)}%</span></div><div className="mt-3 flex flex-wrap gap-1.5">{row.items.slice(0, 4).map((item) => <span key={item.id} className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{item.name}</span>)}{row.items.length > 4 && <span className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">ещё {row.items.length - 4}</span>}</div></div></div></CardContent></Card>;
    })}</div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListTree className="h-4 w-4 text-primary" />Как пользоваться</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Меняйте этап и процент выполнения в позиции сметы — график перестроится сразу. Последовательность этапов настраивается в разделе «Ещё» → «Настройки».</CardContent></Card>
  </div>;
}
