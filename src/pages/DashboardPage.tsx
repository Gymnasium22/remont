import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { formatBr } from '../lib/currency';
import { itemHasZone, zoneShare } from '../lib/zones';
import { useAppStore } from '../store/useAppStore';
import { PAYMENT_LABELS } from '../types';

export function DashboardPage() {
  const project = useAppStore((s) => s.project);
  const zones = useAppStore((s) => s.zones);
  const categories = useAppStore((s) => s.categories);
  const estimateItems = useAppStore((s) => s.estimateItems);
  const expenses = useAppStore((s) => s.expenses);

  const plan = estimateItems.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );
  const fact = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budget = project.totalBudget || plan;
  const remain = budget - fact;
  const overspend = fact > budget ? fact - budget : 0;

  const activeZones = zones.filter((z) => project.activeZones.includes(z.id));

  const zoneProgress = zones
    .map((z) => {
      const items = estimateItems.filter((i) => itemHasZone(i, z.id));
      const planZ = estimateItems.reduce(
        (s, i) => s + zoneShare(i, z.id),
        0,
      );
      const factZ = expenses
        .filter((e) => e.zoneId === z.id)
        .reduce((s, e) => s + e.amount, 0);
      const progress =
        items.length > 0
          ? items.reduce((s, i) => s + i.progress, 0) / items.length
          : 0;
      return { zone: z, planZ, factZ, progress, items: items.length };
    })
    .filter((x) => x.items > 0 || x.factZ > 0)
    .sort((a, b) => b.factZ - a.factZ);

  const catProgress = categories
    .map((c) => {
      const planC = estimateItems
        .filter((i) => i.categoryId === c.id)
        .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const factC = expenses
        .filter((e) => e.categoryId === c.id)
        .reduce((s, e) => s + e.amount, 0);
      return { cat: c, planC, factC };
    })
    .filter((x) => x.planC > 0 || x.factC > 0);

  const planFactChart = zones
    .map((z) => {
      const planZ = estimateItems.reduce(
        (s, i) => s + zoneShare(i, z.id),
        0,
      );
      const factZ = expenses
        .filter((e) => e.zoneId === z.id)
        .reduce((s, e) => s + e.amount, 0);
      return { name: z.name, plan: planZ, fact: factZ, color: z.color };
    })
    .filter((x) => x.plan > 0 || x.fact > 0)
    .slice(0, 8);

  const paymentSplit = (['cash', 'card', 'transfer'] as const).map((m) => ({
    name: PAYMENT_LABELS[m],
    value: expenses
      .filter((e) => e.paymentMethod === m)
      .reduce((s, e) => s + e.amount, 0),
    key: m,
  })).filter((x) => x.value > 0);

  const paymentColors: Record<string, string> = {
    cash: '#22c55e',
    card: '#3b82f6',
    transfer: '#a855f7',
  };

  const overspends = estimateItems
    .map((item) => {
      const p = item.quantity * item.unitPrice;
      const f = expenses
        .filter((e) => e.estimateItemId === item.id)
        .reduce((s, e) => s + e.amount, 0);
      return { item, plan: p, fact: f, diff: f - p };
    })
    .filter((x) => x.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 5);

  const recent = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name || 'МойРемонт'}
        subtitle={
          project.startDate
            ? `Старт: ${new Date(project.startDate + 'T12:00:00').toLocaleDateString('ru-BY')}`
            : 'Локальный трекер сметы и расходов'
        }
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/expenses">
                <Plus className="h-4 w-4" />
                Расход
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="План"
          value={formatBr(plan)}
          hint="По смете"
          tone="neutral"
        />
        <KpiCard
          label="Факт"
          value={formatBr(fact)}
          hint="Потрачено"
          tone="blue"
        />
        <KpiCard
          label={remain >= 0 ? 'Остаток' : 'Минус'}
          value={formatBr(Math.abs(remain))}
          hint={budget ? `Бюджет ${formatBr(budget)}` : 'от плана/бюджета'}
          tone={remain >= 0 ? 'green' : 'red'}
          icon={remain >= 0 ? ArrowDownRight : ArrowUpRight}
        />
        <KpiCard
          label="Перерасход"
          value={formatBr(overspend)}
          hint={overspend > 0 ? 'Сверх бюджета' : 'В рамках'}
          tone={overspend > 0 ? 'red' : 'green'}
          icon={TrendingDown}
        />
      </div>

      {/* Active zones */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Зоны в работе</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings">Изменить</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activeZones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Нет активных зон. Отметьте комнаты в настройках проекта.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeZones.map((z) => (
                <span
                  key={z.id}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: z.color }}
                  />
                  {z.name}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink to="/estimate" label="Добавить в смету" />
        <QuickLink to="/expenses" label="Добавить расход" />
        <QuickLink to="/contractors" label="Контрагенты" />
        <QuickLink to="/settings" label="Проект и данные" />
      </div>

      {/* Zone progress */}
      {zoneProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Прогресс по зонам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {zoneProgress.map(({ zone, planZ, factZ, progress }) => (
              <div key={zone.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: zone.color }}
                    />
                    {zone.name}
                    {project.activeZones.includes(zone.id) && (
                      <Badge variant="success">в работе</Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatBr(factZ)} / {formatBr(planZ)} · {Math.round(progress)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(100, progress)}
                  indicatorClassName="!bg-[var(--bar)]"
                  style={{ ['--bar' as string]: zone.color }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">План vs факт по зонам</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {planFactChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planFactChart} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip
                    formatter={(v) => formatBr(Number(v))}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="plan" name="План" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="fact" name="Факт" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Наличные vs безнал</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {paymentSplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет расходов</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentSplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {paymentSplit.map((e) => (
                      <Cell key={e.key} fill={paymentColors[e.key]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatBr(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      {catProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">По категориям</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {catProgress.map(({ cat, planC, factC }) => {
              const pct = planC > 0 ? Math.min(150, (factC / planC) * 100) : factC > 0 ? 100 : 0;
              return (
                <div key={cat.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: cat.color }}
                      />
                      {cat.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatBr(factC)}
                      {planC > 0 && ` / ${formatBr(planC)}`}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, pct)}
                    indicatorClassName={
                      factC > planC && planC > 0 ? '!bg-red-500' : undefined
                    }
                    style={
                      factC <= planC || planC === 0
                        ? { ['--bar' as string]: cat.color }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Топ перерасходов</CardTitle>
          </CardHeader>
          <CardContent>
            {overspends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Перерасходов по позициям сметы нет
              </p>
            ) : (
              <ul className="space-y-3">
                {overspends.map(({ item, plan: p, fact: f, diff }) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        план {formatBr(p)} · факт {formatBr(f)}
                      </p>
                    </div>
                    <Badge variant="danger">+{formatBr(diff)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Последние расходы</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/expenses">Все</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Расходов пока нет</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((e) => {
                  const zone = zones.find((z) => z.id === e.zoneId);
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {e.comment || zone?.name || 'Расход'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.date} · {PAYMENT_LABELS[e.paymentMethod]}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatBr(e.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  icon: Icon = Wallet,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'blue' | 'green' | 'red';
  icon?: typeof Wallet;
}) {
  const tones = {
    neutral: 'from-slate-500/10 to-transparent',
    blue: 'from-blue-500/10 to-transparent',
    green: 'from-emerald-500/10 to-transparent',
    red: 'from-red-500/10 to-transparent',
  };
  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${tones[tone]}`}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-lg font-bold tabular-nums tracking-tight md:text-xl">
          {value}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center rounded-2xl border border-border bg-card px-3 py-3 text-center text-sm font-medium shadow-sm transition hover:bg-muted active:scale-[0.98]"
    >
      {label}
    </Link>
  );
}
