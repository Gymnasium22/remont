import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { applyTelegramTheme, getTelegram } from './useTelegram';

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const theme = useAppStore((s) => s.settings.theme);
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const apply = () => {
      const dark =
        theme === 'dark' || (theme === 'system' && systemPrefersDark());
      setResolved(dark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', dark);
      applyTelegramTheme(getTelegram(), dark);
    };
    apply();

    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, resolved };
}
