import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ChipOption {
  id: string;
  name: string;
  color?: string;
}

interface MultiChipsProps {
  options: ChipOption[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel?: string;
  className?: string;
}

export function MultiChips({
  options,
  selected,
  onToggle,
  emptyLabel,
  className,
}: MultiChipsProps) {
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? 'Нет вариантов'}
      </p>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const on = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={cn(
              'inline-flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-medium transition',
              on
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: opt.color }}
              />
            )}
            <span className="truncate">{opt.name}</span>
            {on && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
