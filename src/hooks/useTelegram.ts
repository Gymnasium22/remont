import { useEffect, useMemo, useState } from 'react';

/** Minimal Telegram WebApp types */
export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  platform: string;
  initData: string;
  initDataUnsafe: { user?: { first_name?: string; username?: string } };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    isVisible: boolean;
  };
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (t: string) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegram(): TelegramWebApp | null {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null;
}

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    const webapp = getTelegram();
    if (!webapp) return;
    webapp.ready();
    webapp.expand();
    try {
      webapp.disableVerticalSwipes?.();
    } catch {
      /* older clients */
    }
    setTg(webapp);
  }, []);

  const isTelegram = useMemo(() => {
    if (!tg) return false;
    return Boolean(tg.initData) || tg.platform !== 'unknown';
  }, [tg]);

  return { tg, isTelegram };
}

export function useTelegramBackButton(visible: boolean, onBack: () => void) {
  const { tg, isTelegram } = useTelegram();

  useEffect(() => {
    if (!tg || !isTelegram) return;
    const handler = () => onBack();
    if (visible) {
      tg.BackButton.show();
      tg.BackButton.onClick(handler);
    } else {
      tg.BackButton.hide();
    }
    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [tg, isTelegram, visible, onBack]);
}

export function applyTelegramTheme(tg: TelegramWebApp | null, isDark: boolean) {
  if (!tg) return;
  const bg = isDark ? '#0b1220' : '#f8fafc';
  const header = isDark ? '#0b1220' : '#ffffff';
  try {
    tg.setBackgroundColor?.(bg);
    tg.setHeaderColor?.(header);
  } catch {
    /* ignore */
  }

  const root = document.documentElement;
  const tp = tg.themeParams;
  if (tp.bg_color) root.style.setProperty('--tg-bg', tp.bg_color);
  if (tp.text_color) root.style.setProperty('--tg-text', tp.text_color);
  if (tp.button_color) root.style.setProperty('--tg-button', tp.button_color);
  if (tp.secondary_bg_color)
    root.style.setProperty('--tg-secondary-bg', tp.secondary_bg_color);
  if (tp.hint_color) root.style.setProperty('--tg-hint', tp.hint_color);
}
