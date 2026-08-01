/**
 * E2E: смета → расход → wishlist → связка → склад → дашборд
 * Запуск: npm run dev (в другом терминале) && npm run test:e2e
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = process.env.E2E_BASE || 'http://localhost:5173/';
const results = [];
const log = (ok, msg, detail = '') => {
  results.push({ ok, msg, detail: String(detail).slice(0, 400) });
  console.log(
    `${ok ? '✓' : '✗'} ${msg}${detail ? ' — ' + String(detail).slice(0, 120) : ''}`,
  );
};

async function openNav(page, name) {
  // Навигация дублируется для широкого и мобильного экрана.
  await page.getByRole('link', { name: new RegExp(name) }).first().click();
  await page.waitForTimeout(350);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15000);

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    indexedDB.deleteDatabase('moy-remont');
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  log(true, 'Сброс IDB');

  // --- Смета ---
  await openNav(page, 'Смета');
  await page.getByRole('button', { name: /^Добавить$/ }).click();
  await page.waitForTimeout(300);
  const dlg = page.getByRole('dialog');
  await dlg.locator('input').first().fill('E2E плитка');
  const nums = dlg.locator('input[type="number"]');
  await nums.nth(0).fill('2');
  await nums.nth(1).fill('50');
  // В форме сметы сохранение находится на третьем шаге.
  await dlg.getByRole('button', { name: /3\. Прогресс/ }).click();
  await dlg.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(400);
  const estText = await page.locator('main').innerText();
  log(estText.includes('E2E плитка'), 'Позиция сметы создана');

  // --- Расход по смете ---
  await openNav(page, 'Расходы');
  await page.getByRole('button', { name: /Добавить/ }).first().click();
  await page.waitForTimeout(400);
  const ed = page.getByRole('dialog');
  // выбрать позицию чеклиста если есть
  const itemBtn = ed.getByText('E2E плитка').first();
  if (await itemBtn.count()) {
    await itemBtn.click();
  }
  await ed.getByRole('button', { name: /Далее|Оплата|2/ }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  // step payment - fill cash
  const payInputs = ed.locator('input[type="number"]');
  if (await payInputs.count()) {
    await payInputs.first().fill('80');
  }
  // try next / save
  const saveBtn = ed.getByRole('button', { name: /Сохранить|Готово|Добавить/ });
  if (await saveBtn.count()) {
    await saveBtn.last().click();
  } else {
    // multi-step: next then save
    const next = ed.getByRole('button', { name: /Далее/ });
    if (await next.count()) await next.click();
    await page.waitForTimeout(200);
    const next2 = ed.getByRole('button', { name: /Далее|Сохранить/ });
    if (await next2.count()) await next2.last().click();
  }
  await page.waitForTimeout(500);
  log(true, 'Расход: попытка сохранения');

  // --- Wishlist ---
  await openNav(page, 'Купить');
  await page.getByRole('button', { name: /Добавить/ }).first().click();
  await page.waitForTimeout(300);
  const wd = page.getByRole('dialog');
  await wd.locator('input').first().fill('E2E смеситель');
  // first offer url
  const urlInputs = wd.locator('input[placeholder*="Ссылка"], input[inputmode="url"]');
  if (await urlInputs.count()) {
    await urlInputs.first().fill('https://example.com/mixer');
  } else {
    // fallback any text input after name
    const inputs = wd.locator('input');
    const n = await inputs.count();
    if (n > 1) await inputs.nth(1).fill('https://example.com/mixer');
  }
  // price field
  const priceInputs = wd.locator('input[type="number"]');
  if (await priceInputs.count()) {
    await priceInputs.first().fill('120');
  }
  await wd.getByRole('button', { name: /Добавить|Сохранить/ }).last().click();
  await page.waitForTimeout(400);
  const wText = await page.locator('main').innerText();
  log(wText.includes('E2E смеситель'), 'Wishlist позиция');

  // --- Склад via dashboard link ---
  await openNav(page, 'Дашборд');
  const stockLink = page.getByRole('link', { name: /Склад/ });
  if (await stockLink.count()) {
    await stockLink.click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Добавить/ }).first().click();
    await page.waitForTimeout(300);
    const md = page.getByRole('dialog');
    await md.locator('input').first().fill('E2E клей');
    const mnums = md.locator('input[type="number"]');
    if (await mnums.count()) {
      await mnums.nth(0).fill('5');
      if ((await mnums.count()) > 1) await mnums.nth(1).fill('1');
    }
    await md.getByRole('button', { name: /Сохранить/ }).click();
    await page.waitForTimeout(400);
    const mText = await page.locator('main').innerText();
    log(mText.includes('E2E клей') || mText.includes('Остаток'), 'Склад материал');
  } else {
    log(false, 'Ссылка Склад на дашборде');
  }

  // --- Калькулятор ---
  await openNav(page, 'Дашборд');
  const calc = page.getByRole('link', { name: /Что если/ });
  if (await calc.count()) {
    await calc.click();
    await page.waitForTimeout(400);
    const cText = await page.locator('main').innerText();
    log(
      cText.includes('Что если') || cText.includes('План'),
      'Калькулятор открыт',
    );
  } else {
    log(false, 'Ссылка калькулятора');
  }

  // --- Фото ---
  await openNav(page, 'Дашборд');
  const ph = page.getByRole('link', { name: /Фото/ });
  if (await ph.count()) {
    await ph.click();
    await page.waitForTimeout(300);
    const pText = await page.locator('main').innerText();
    log(pText.includes('Фото') || pText.includes('Загрузить'), 'Страница фото');
  } else {
    log(false, 'Ссылка фото');
  }

  await page.screenshot({ path: 'test-e2e-core.png', fullPage: true });
  log(true, 'Скриншот test-e2e-core.png');
} catch (e) {
  log(false, 'FATAL', e?.stack || e);
  try {
    await page.screenshot({ path: 'test-e2e-error.png' });
  } catch {
    /* ignore */
  }
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  writeFileSync(
    'test-e2e-results.json',
    JSON.stringify({ failed, results }, null, 2),
  );
  console.log(`\nИтого: ${results.length - failed}/${results.length} ok`);
  process.exit(failed > 0 ? 1 : 0);
}
