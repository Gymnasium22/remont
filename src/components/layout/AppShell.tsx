import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Home,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTelegram, useTelegramBackButton } from '../../hooks/useTelegram';
import { useTheme } from '../../hooks/useTheme';
import { useCallback } from 'react';

const nav = [
  { to: '/', label: 'Дашборд', icon: Home, end: true },
  { to: '/estimate', label: 'Смета', icon: ClipboardList },
  { to: '/expenses', label: 'Расходы', icon: Receipt },
  { to: '/contractors', label: 'Люди', icon: Users },
  { to: '/settings', label: 'Ещё', icon: Settings },
];

export function AppShell() {
  useTheme();
  const { isTelegram } = useTelegram();
  const location = useLocation();
  const navigate = useNavigate();
  const isRoot = location.pathname === '/';

  const onBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useTelegramBackButton(!isRoot && isTelegram, onBack);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl',
          'pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2 md:gap-4 md:px-6 md:py-3">
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              М
            </div>
            <span className="text-sm font-semibold tracking-tight">
              МойРемонт
            </span>
          </div>

          <nav className="min-w-0 flex-1">
            <ul className="flex items-stretch justify-between gap-0.5 sm:justify-start sm:gap-1 md:gap-1.5">
              {nav.map((item) => (
                <li key={item.to} className="min-w-0 flex-1 sm:flex-none">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-2 text-[10px] font-medium transition-colors sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <main className="px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
