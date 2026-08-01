import type { Category, EstimateItem, Expense, Stage, Zone } from '../types';
import {
  expenseCategoryShare,
  expenseEstimateShare,
  expenseZoneShare,
} from './expense';
import { itemExpectedPaid, itemPlan, zoneShare } from './zones';
import { buildPlanByItemId } from '../store/useAppStore';

export function projectTotals(
  estimateItems: EstimateItem[],
  expenses: Expense[],
  budget: number,
) {
  const plan = estimateItems.reduce((sum, item) => sum + itemPlan(item), 0);
  const fact = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expected = estimateItems.reduce(
    (sum, item) => sum + itemExpectedPaid(item),
    0,
  );
  const limit = budget > 0 ? budget : plan;
  return { plan, fact, expected, limit, remain: limit - fact };
}

export function byZone(
  zones: Zone[],
  estimateItems: EstimateItem[],
  expenses: Expense[],
) {
  return zones
    .map((zone) => ({
      zone,
      plan: estimateItems.reduce((sum, item) => sum + zoneShare(item, zone.id), 0),
      fact: expenses.reduce((sum, expense) => sum + expenseZoneShare(expense, zone.id), 0),
    }))
    .filter((row) => row.plan > 0 || row.fact > 0)
    .sort((a, b) => b.fact - a.fact);
}

export function byCategory(
  categories: Category[],
  estimateItems: EstimateItem[],
  expenses: Expense[],
) {
  return categories
    .map((category) => ({
      category,
      plan: estimateItems
        .filter((item) => item.categoryId === category.id)
        .reduce((sum, item) => sum + itemPlan(item), 0),
      fact: expenses.reduce(
        (sum, expense) => sum + expenseCategoryShare(expense, category.id),
        0,
      ),
    }))
    .filter((row) => row.plan > 0 || row.fact > 0)
    .sort((a, b) => b.fact - a.fact);
}

export function byStage(stages: Stage[], estimateItems: EstimateItem[]) {
  return [...stages]
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const items = estimateItems.filter((item) => item.stageId === stage.id);
      const plan = items.reduce((sum, item) => sum + itemPlan(item), 0);
      const progress =
        plan > 0
          ? items.reduce((sum, item) => sum + itemPlan(item) * item.progress, 0) / plan
          : 0;
      return { stage, items, plan, progress };
    })
    .filter((row) => row.items.length > 0);
}

export function overspendItems(estimateItems: EstimateItem[], expenses: Expense[]) {
  const plans = buildPlanByItemId(estimateItems);
  return estimateItems
    .map((item) => {
      const plan = itemExpectedPaid(item);
      const fact = expenses.reduce(
        (sum, expense) => sum + expenseEstimateShare(expense, item.id, plans),
        0,
      );
      return { item, plan, fact, diff: fact - plan };
    })
    .filter((row) => row.diff > 0.01)
    .sort((a, b) => b.diff - a.diff);
}
