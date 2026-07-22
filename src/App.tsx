import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { useAppStore } from './store/useAppStore';
import { ContractorsPage } from './pages/ContractorsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EstimatePage } from './pages/EstimatePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SettingsPage } from './pages/SettingsPage';

/** HashRouter для GitHub Pages / Telegram; BrowserRouter если задан base с историей */
const Router =
  import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-primary/20" />
          <p className="text-sm text-muted-foreground">Загрузка МойРемонт…</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="estimate" element={<EstimatePage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="contractors" element={<ContractorsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster
        position="top-center"
        richColors
        closeButton
        theme="system"
        toastOptions={{
          classNames: {
            toast: 'rounded-2xl border border-border shadow-lg',
          },
        }}
      />
    </Router>
  );
}
