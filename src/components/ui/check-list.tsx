import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckListItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface CheckListProps {
  items: CheckListItem[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel?: string;
  className?: string;
  /** Ограничение высоты списка со своим скроллом */
  maxHeightClass?: string;
}

/** Компактный список с чекбоксами — без «распирания» чипами */
export function CheckList({
  items,
  selected,
  onToggle,
  emptyLabel,
  className,
  maxHeightClass = 'max-h-48',
}: CheckListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? 'Нет вариантов'}
      </p>
    );
  }

  return (
    <ul
      className={cn(
        'overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-border divide-y divide-border',
        maxHeightClass,
        className,
      )}
    >
      {items.map((item) => {
        const on = selected.includes(item.id);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                'flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition',
                on ? 'bg-primary/8' : 'hover:bg-muted/60',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card',
                )}
              >
                {on && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
