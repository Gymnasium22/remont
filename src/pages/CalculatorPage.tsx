import { useMemo, useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  labelFactors,
  whatIfTotals,
  type WhatIfFactors,
} from '../lib/calculator';
import { formatBr } from '../lib/currency';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

/** percent string → factor (10 → 1.10, -5 → 0.95) */
function pctToFactor(pct: string): number {
  const n = Number(pct);
  if (Number.isNaN(n)) return 1;
  return 1 + n / 100;
}

function factorToPct(f: number): string {
  if (f === 1) return '';
  const p = Math.round((f - 1) * 1000) / 10;
  return String(p);
}

export function CalculatorPage() {
  const estimateItems = useAppStore((s) => s.estimateItems);
  const categories = useAppStore((s) => s.categories);
  const zones = useAppStore((s) => s.zones);
  const stages = useAppStore((s) => s.stages);
  const project = useAppStore((s) => s.project);
  const expenses = useAppStore((s) => s.expenses);

  const [globalPct, setGlobalPct] = useState('');
  const [catPct, setCatPct] = useState<Record<string, string>>({});
  const [zonePct, setZonePct] = useState<Record<string, string>>({});
  const [stagePct, setStagePct] = useState<Record<string, string>>({});

  const factors: WhatIfFactors = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byZone: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    for (const [id, v] of Object.entries(catPct)) {
      if (v !== '' && v != null) byCategory[id] = pctToFactor(v);
    }
    for (const [id, v] of Object.entries(zonePct)) {
      if (v !== '' && v != null) byZone[id] = pctToFactor(v);
    }
    for (const [id, v] of Object.entries(stagePct)) {
      if (v !== '' && v != null) byStage[id] = pctToFactor(v);
    }
    return {
      global: globalPct === '' ? 1 : pctToFactor(globalPct),
      byCategory,
      byZone,
      byStage,
    };
  }, [globalPct, catPct, zonePct, stagePct]);

  const result = useMemo(
    () => whatIfTotals(estimateItems, factors),
    [estimateItems, factors],
  );

  const fact = expenses.reduce((s, e) => s + e.amount, 0);
  const budget = project.totalBudget > 0 ? project.totalBudget : result.base;
  const remainBase = budget - fact;
  // if plan grows, remaining budget shrinks by delta
  const remainAfterWhatIf = budget - fact - result.delta;

  const reset = () => {
    setGlobalPct('');
    setCatPct({});
    setZonePct({});
    setStagePct({});
  };

  const usedCats = categories.filter((c) =>
    estimateItems.some((i) => i.categoryId === c.id),
  );
  const usedZones = zones.filter((z) =>
    estimateItems.some((i) => i.zoneIds?.includes(z.id) || i.zoneId === z.id),
  );
  const usedStages = stages.filter((s) =>
    estimateItems.some((i) => i.stageId === s.id),
  );

  const factorLabels = labelFactors(factors, categories, zones, stages);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Что если…"
        subtitle="Калькулятор: как изменится смета при подорожании"
        action={
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Сброс
          </Button>
        }
      />

      {estimateItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Calculator className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Смета пуста</p>
            <p className="text-sm text-muted-foreground">
              Добавьте позиции в смету — калькулятор посчитает сценарии.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">План сейчас</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatBr(result.base)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">После сценария</p>
                <p className="text-xl font-bold tabular-nums text-primary">
                  {formatBr(result.adjusted)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Дельта</p>
                <p
                  className={cn(
                    'text-xl font-bold tabular-nums',
                    result.delta > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : result.delta < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : '',
                  )}
                >
                  {result.delta >= 0 ? '+' : ''}
                  {formatBr(result.delta)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({result.deltaPercent >= 0 ? '+' : ''}
                    {result.deltaPercent.toFixed(1)}%)
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Факт расходов: </span>
                <span className="font-semibold tabular-nums">
                  {formatBr(fact)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">
                  {project.totalBudget > 0 ? 'Бюджет' : 'Опора (план)'}:{' '}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatBr(budget)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">
                  Остаток сейчас (бюджет − факт):{' '}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatBr(remainBase)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">
                  Если сценарий «съест» дельту плана:{' '}
                </span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    remainAfterWhatIf < 0 &&
                      'text-destructive',
                  )}
                >
                  {formatBr(remainAfterWhatIf)}
                </span>
              </p>
              {factorLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {factorLabels.map((l) => (
                    <Badge key={l} variant="secondary">
                      {l}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Глобально, %</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-muted-foreground">
                На всю смету (+10 = подорожание на 10%)
              </Label>
              <Input
                className="mt-1.5 max-w-[160px]"
                type="number"
                step="0.5"
                placeholder="0"
                value={globalPct}
                onChange={(e) => setGlobalPct(e.target.value)}
              />
            </CardContent>
          </Card>

          {usedCats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">По категориям, %</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {usedCats.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: c.color }}
                    />
                    <Label className="min-w-0 flex-1 truncate">{c.name}</Label>
                    <Input
                      className="w-20"
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={catPct[c.id] ?? ''}
                      onChange={(e) =>
                        setCatPct((prev) => ({
                          ...prev,
                          [c.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {usedZones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">По зонам, %</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {usedZones.map((z) => (
                  <div key={z.id} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: z.color }}
                    />
                    <Label className="min-w-0 flex-1 truncate">{z.name}</Label>
                    <Input
                      className="w-20"
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={zonePct[z.id] ?? ''}
                      onChange={(e) =>
                        setZonePct((prev) => ({
                          ...prev,
                          [z.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {usedStages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">По этапам, %</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {usedStages.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Label className="min-w-0 flex-1 truncate">{s.name}</Label>
                    <Input
                      className="w-20"
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={stagePct[s.id] ?? factorToPct(1)}
                      onChange={(e) =>
                        setStagePct((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
