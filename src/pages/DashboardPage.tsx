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
import {
  expenseCategoryShare,
  expenseEstimateShare,
  expenseZoneShare,
  getExpenseZoneIds,
  paymentAmountByMethod,
} from '../lib/expense';
import {
  itemDiyEconomy,
  itemExpectedPaid,
  itemHasZone,
  itemPlan,
  zoneShare,
} from '../lib/zones';
import {
  buildPlanByItemId,
  selectItemFact,
  useAppStore,
} from '../store/useAppStore';
import { getExpenseEstimateIds } from '../lib/expense';
import { PAYMENT_LABELS } from '../types';

export function DashboardPage() {
  const project = useAppStore((s) => s.project);
  const zones = useAppStore((s) => s.zones);
  const categories = useAppStore((s) => s.categories);
  const estimateItems = useAppStore((s) => s.estimateItems);
  const expenses = useAppStore((s) => s.expenses);

  const plan = estimateItems.reduce((sum, i) => sum + itemPlan(i), 0);
  /** Все траты (смета + покупки в магазине) */
  const fact = expenses.reduce((sum, e) => sum + e.amount, 0);
  /** Только оплаты по позициям сметы (без «Покупка») */
  const factOnEstimate = estimateItems.reduce(
    (sum, i) => sum + selectItemFact(expenses, i.id, estimateItems),
    0,
  );
  const factShop = expenses
    .filter((e) => getExpenseEstimateIds(e).length === 0)
    .reduce((sum, e) => sum + e.amount, 0);
  const diyEconomy = estimateItems.reduce(
    (sum, i) => sum + itemDiyEconomy(i),
    0,
  );
  const expectedPaid = estimateItems.reduce(
    (sum, i) => sum + itemExpectedPaid(i),
    0,
  );
  const hasBudget = project.totalBudget > 0;
  const budget = hasBudget ? project.totalBudget : plan;
  /** Остаток: от бюджета, если задан; иначе план сметы − все траты */
  const remain = budget - fact;
  const overspend = fact > budget && budget > 0 ? fact - budget : 0;
  /** Ещё к оплате по смете: план−DIY − только расходы «по смете» */
  const planGap = Math.max(0, expectedPaid - factOnEstimate);

  const activeZones = zones.filter((z) => project.activeZones.includes(z.id));

  const zoneProgress = zones
    .map((z) => {
      const items = estimateItems.filter((i) => itemHasZone(i, z.id));
      const planZ = estimateItems.reduce(
        (s, i) => s + zoneShare(i, z.id),
        0,
      );
      const factZ = expenses.reduce(
        (s, e) => s + expenseZoneShare(e, z.id),
        0,
      );
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
      const factC = expenses.reduce(
        (s, e) => s + expenseCategoryShare(e, c.id),
        0,
      );
      return { cat: c, planC, factC };
    })
    .filter((x) => x.planC > 0 || x.factC > 0);

  const planFactChart = zones
    .map((z) => {
      const planZ = estimateItems.reduce(
        (s, i) => s + zoneShare(i, z.id),
        0,
      );
      const factZ = expenses.reduce(
        (s, e) => s + expenseZoneShare(e, z.id),
        0,
      );
      return { name: z.name, plan: planZ, fact: factZ, color: z.color };
    })
    .filter((x) => x.plan > 0 || x.fact > 0)
    .slice(0, 8);

  const paymentSplit = (['cash', 'card', 'transfer'] as const).map((m) => ({
    name: PAYMENT_LABELS[m],
    value: expenses.reduce((s, e) => s + paymentAmountByMethod(e, m), 0),
    key: m,
  })).filter((x) => x.value > 0);

  const paymentColors: Record<string, string> = {
    cash: '#22c55e',
    card: '#3b82f6',
    transfer: '#a855f7',
  };

  const planByItemId = buildPlanByItemId(estimateItems);
  const overspends = estimateItems
    .map((item) => {
      const p = itemExpectedPaid(item);
      const full = itemPlan(item);
      const f = expenses.reduce(
        (s, e) => s + expenseEstimateShare(e, item.id, planByItemId),
        0,
      );
      return { item, plan: p, full, fact: f, diff: f - p };
    })
    .filter((x) => x.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 5);

  const recent = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const isEmpty =
    estimateItems.length === 0 && expenses.length === 0;

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
              <Link to="/expenses?new=1">
                <Plus className="h-4 w-4" />
                Расход
              </Link>
            </Button>
          </div>
        }
      />

      {isEmpty && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="space-y-3 p-5">
            <p className="font-semibold">С чего начать</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <Link to="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
                  Настройки
                </Link>
                {' — '}название, бюджет, зоны в работе
              </li>
              <li>
                <Link to="/estimate" className="font-medium text-primary underline-offset-2 hover:underline">
                  Смета
                </Link>
                {' — '}работы прораба и допработы по ходу
              </li>
              <li>
                <Link to="/expenses?new=1" className="font-medium text-primary underline-offset-2 hover:underline">
                  Расходы
                </Link>
                {' — '}авансы «по смете» и покупки в магазине «вне сметы»
              </li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link to="/estimate">Открыть смету</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/expenses?new=1">Добавить расход</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Деньги: план / факт / бюджет */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Деньги
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard
            label="План сметы"
            value={formatBr(plan)}
            hint="Работы и допработы"
            tone="neutral"
          />
          <KpiCard
            label="Потрачено всего"
            value={formatBr(fact)}
            hint={
              factShop > 0
                ? `Смета ${formatBr(factOnEstimate)} · магазин ${formatBr(factShop)}`
                : 'Смета + покупки'
            }
            tone="blue"
          />
          <KpiCard
            label={remain >= 0 ? 'Остаток бюджета' : 'Минус к бюджету'}
            value={formatBr(Math.abs(remain))}
            hint={
              hasBudget
                ? `Бюджет ${formatBr(budget)} − все траты`
                : `От плана сметы ${formatBr(plan)} (бюджет не задан)`
            }
            tone={remain >= 0 ? 'green' : 'red'}
            icon={remain >= 0 ? ArrowDownRight : ArrowUpRight}
          />
        </div>
      </div>

      {/* Смета: DIY / к оплате / перерасход */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          По смете (без магазина)
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard
            label="Своими силами"
            value={formatBr(diyEconomy)}
            hint={
              diyEconomy > 0
                ? `Экономия · к оплате наёмным ${formatBr(expectedPaid)}`
                : 'Отметьте % DIY в смете'
            }
            tone="green"
          />
          <KpiCard
            label="Ещё к оплате"
            value={formatBr(planGap)}
            hint={`${formatBr(expectedPaid)} − оплачено ${formatBr(factOnEstimate)}`}
            tone={planGap > 0 ? 'neutral' : 'green'}
          />
          <KpiCard
            label="Перерасход"
            value={formatBr(overspend)}
            hint={
              overspend > 0
                ? 'Сверх бюджета (все траты)'
                : hasBudget
                  ? 'В рамках бюджета'
                  : 'Задайте бюджет в настройках'
            }
            tone={overspend > 0 ? 'red' : 'green'}
            icon={TrendingDown}
          />
        </div>
      </div>

      {diyEconomy > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              Экономия своими силами: {formatBr(diyEconomy)}
            </p>
            <p className="mt-1 text-muted-foreground">
              Из плана {formatBr(plan)} вы закрыли {formatBr(diyEconomy)} без
              оплаты наёмным. К ожидаемым платежам по смете:{' '}
              {formatBr(expectedPaid)}, уже по смете: {formatBr(factOnEstimate)}.
            </p>
          </CardContent>
        </Card>
      )}

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
        <QuickLink to="/expenses?new=1" label="Добавить расход" />
        <QuickLink to="/expenses?new=1&kind=shop" label="Покупка в магазине" />
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
                        к оплате {formatBr(p)} · факт {formatBr(f)}
                        {(item.selfDonePercent ?? 0) > 0
                          ? ` · DIY ${item.selfDonePercent}%`
                          : ''}
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
                  const zoneNames = getExpenseZoneIds(e)
                    .map((id) => zones.find((z) => z.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {e.comment || zoneNames || 'Расход'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.date}
                          {e.paymentParts?.length
                            ? ` · ${e.paymentParts
                                .map(
                                  (p) =>
                                    `${PAYMENT_LABELS[p.method]} ${formatBr(p.amount)}`,
                                )
                                .join(', ')}`
                            : e.paymentMethod
                              ? ` · ${PAYMENT_LABELS[e.paymentMethod]}`
                              : ''}
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
