import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { useAppStore } from './store/useAppStore';

/** Code-split по страницам — меньше initial JS */
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const EstimatePage = lazy(() =>
  import('./pages/EstimatePage').then((m) => ({ default: m.EstimatePage })),
);
const ExpensesPage = lazy(() =>
  import('./pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
);
const WishlistPage = lazy(() =>
  import('./pages/WishlistPage').then((m) => ({ default: m.WishlistPage })),
);
const ContractorsPage = lazy(() =>
  import('./pages/ContractorsPage').then((m) => ({
    default: m.ContractorsPage,
  })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const MaterialsPage = lazy(() =>
  import('./pages/MaterialsPage').then((m) => ({ default: m.MaterialsPage })),
);
const PhotosPage = lazy(() =>
  import('./pages/PhotosPage').then((m) => ({ default: m.PhotosPage })),
);
const CalculatorPage = lazy(() =>
  import('./pages/CalculatorPage').then((m) => ({
    default: m.CalculatorPage,
  })),
);

/** HashRouter для GitHub Pages / Telegram; BrowserRouter если задан base с историей */
const Router =
  import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;

function PageFallback() {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-2xl bg-primary/20" />
    </div>
  );
}

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
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="estimate"
            element={
              <Suspense fallback={<PageFallback />}>
                <EstimatePage />
              </Suspense>
            }
          />
          <Route
            path="expenses"
            element={
              <Suspense fallback={<PageFallback />}>
                <ExpensesPage />
              </Suspense>
            }
          />
          <Route
            path="wishlist"
            element={
              <Suspense fallback={<PageFallback />}>
                <WishlistPage />
              </Suspense>
            }
          />
          <Route
            path="materials"
            element={
              <Suspense fallback={<PageFallback />}>
                <MaterialsPage />
              </Suspense>
            }
          />
          <Route
            path="photos"
            element={
              <Suspense fallback={<PageFallback />}>
                <PhotosPage />
              </Suspense>
            }
          />
          <Route
            path="calc"
            element={
              <Suspense fallback={<PageFallback />}>
                <CalculatorPage />
              </Suspense>
            }
          />
          <Route
            path="contractors"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContractorsPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster
        position="top-center"
        richColors
        closeButton
        theme="system"
        offset={16}
        toastOptions={{
          classNames: {
            toast: 'rounded-2xl border border-border shadow-lg z-[100]',
          },
          duration: 2800,
        }}
      />
    </Router>
  );
}
