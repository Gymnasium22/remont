import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ZoneChips({
  zones,
  selected,
  onToggle,
}: {
  zones: { id: string; name: string; color: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {zones.map((z) => {
        const on = selected.includes(z.id);
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => onToggle(z.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition',
              on
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: z.color }}
            />
            {z.name}
            {on && <Check className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );
}
