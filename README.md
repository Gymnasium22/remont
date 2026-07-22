# МойРемонт

Локальный трекер сметы и расходов на ремонт квартиры.

- **Валюта:** белорусские рубли (Br)
- **Стек:** React 19, TypeScript, Vite, Tailwind CSS, Zustand, IndexedDB, Recharts
- **Платформы:** веб, PWA (офлайн), Telegram Mini App
- **Хостинг:** статика, GitHub Pages

## Команды

```bash
npm install
npm run dev      # разработка
npm run build    # production-сборка в dist/
npm run preview  # просмотр dist
```

## GitHub Pages

1. В репозитории включите Pages: **Settings → Pages → Deploy from branch** `gh-pages` (или GitHub Actions).
2. Для этого репозитория base path — `/remont/`:

```bash
# Windows PowerShell
$env:VITE_BASE="/remont/"; npm run build
```

```bash
# bash
VITE_BASE=/remont/ npm run build
```

Репозиторий: https://github.com/stasevichnikita0505-afk/remont

3. Залейте содержимое `dist/` в ветку `gh-pages` (или используйте action `peaceiris/actions-gh-pages`).

Приложение использует **HashRouter** при `base !== /`, поэтому маршруты вида `/#/expenses` работают без настройки SPA на сервере.

## Telegram Mini App

1. Задеплойте приложение на HTTPS (GitHub Pages).
2. В [@BotFather](https://t.me/BotFather) создайте бота → **Menu Button** / **Mini App** → URL вашего сайта.
3. SDK подключается из `index.html` (`telegram-web-app.js`): `ready`, `expand`, `BackButton`, цвета темы.

## Данные

Все данные хранятся **только на устройстве** (IndexedDB). Экспорт/импорт — полный JSON `version: 1`.

## Структура

```
src/
  components/   UI и layout
  hooks/        тема, Telegram
  lib/          idb, валюта, defaults
  pages/        дашборд, смета, расходы, контрагенты, настройки
  store/        Zustand
  types/
```
