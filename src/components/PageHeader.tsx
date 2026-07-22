import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex items-start justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
