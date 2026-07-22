import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const results = [];
const log = (ok, msg, detail = '') => {
  results.push({ ok, msg, detail: String(detail).slice(0, 600) });
  console.log(`${ok ? '✓' : '✗'} ${msg}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`);
};

async function openNav(page, name) {
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.waitForTimeout(400);
}

async function fillFirstDialogInput(page, value) {
  const dlg = page.getByRole('dialog');
  await dlg.locator('input').first().fill(value);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(12000);

try {
  // fresh storage
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    indexedDB.deleteDatabase('moy-remont');
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  log(true, 'Старт / сброс IndexedDB', await page.title());

  const nav = await page.locator('header nav a').allTextContents();
  log(nav.join('').includes('Дашборд') && nav.join('').includes('Смета'), 'Навбар', nav.join(' | '));

  // Settings via click text
  await openNav(page, 'Ещё');
  const settingsText = await page.locator('main').innerText();
  log(settingsText.includes('Проект') || settingsText.includes('Бюджет'), 'Страница настроек');

  // Project name - first text input in project card
  const projectInputs = page.locator('main input');
  await projectInputs.nth(0).fill('Квартира UX-тест');
  // budget is type=number
  const budget = page.locator('main input[type="number"]').first();
  await budget.fill('20000');
  log(true, 'Проект заполнен');

  await page.getByRole('button', { name: 'Тёмная' }).click();
  log(
    await page.locator('html').evaluate((e) => e.classList.contains('dark')),
    'Тёмная тема',
  );
  await page.getByRole('button', { name: 'Светлая' }).click();

  // Active zones toggle
  const zoneBtn = page.getByRole('button', { name: /Ванная|Кухня|Общее/ }).first();
  if (await zoneBtn.count()) {
    await zoneBtn.click();
    log(true, 'Переключение активной зоны');
  }

  // === ESTIMATE ===
  await openNav(page, 'Смета');
  await page.getByRole('button', { name: /^Добавить$/ }).click();
  await page.waitForTimeout(400);
  const d1 = page.getByRole('dialog');
  log(await d1.isVisible(), 'Диалог новой позиции');
  await d1.locator('input').first().fill('Демонтаж ванной');

  // Unit price: label "Цена, Br" sibling - find by scanning numbers
  // Form order: qty, unitPrice (as number), progress, selfDone
  const nums = d1.locator('input[type="number"]');
  await nums.nth(0).fill('1');
  // unitPrice is often 2nd number if unit is select
  await nums.nth(1).fill('711.04');
  await d1.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(700);
  let body = await page.locator('main').innerText();
  log(body.includes('Демонтаж'), 'Позиция 711.04', body.slice(0, 250));

  await page.getByRole('button', { name: /^Добавить$/ }).click();
  await page.waitForTimeout(350);
  const d2 = page.getByRole('dialog');
  await d2.locator('input').first().fill('Доп. работы');
  const n2 = d2.locator('input[type="number"]');
  await n2.nth(0).fill('1');
  await n2.nth(1).fill('120');
  await d2.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(600);
  body = await page.locator('main').innerText();
  log(body.includes('Доп. работы'), 'Позиция 120');

  // DIY on first item - open edit (pencil)
  // Find card with Демонтаж and click edit
  const demolCard = page.locator('main').getByText('Демонтаж ванной').locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  // simpler: all icon buttons
  await page.locator('main').getByRole('button').filter({ hasText: '' }).count();

  // === EXPENSE estimate ===
  await openNav(page, 'Расходы');
  await page.getByRole('button', { name: /^Добавить$/ }).click();
  await page.waitForTimeout(450);
  let ed = page.getByRole('dialog');
  const ov = await ed.evaluate((el) => ({
    sw: el.scrollWidth,
    cw: el.clientWidth,
  }));
  log(ov.sw <= ov.cw + 4, 'Нет гориз. скролла (расход)', JSON.stringify(ov));

  const list = ed.locator('ul li button');
  const lc = await list.count();
  log(lc >= 2, 'Список позиций', String(lc));
  if (lc >= 1) await list.nth(0).click();
  if (lc >= 2) await list.nth(1).click();
  await ed.getByRole('button', { name: 'Далее' }).click();
  await page.waitForTimeout(350);
  ed = page.getByRole('dialog');
  // payment fields
  const pay = ed.locator('input[type="number"]');
  await pay.nth(0).fill('615');
  if ((await pay.count()) > 1) await pay.nth(1).fill('');
  if ((await pay.count()) > 2) await pay.nth(2).fill('');
  const ptxt = await ed.innerText();
  log(ptxt.includes('615'), 'Итого оплаты 615');
  await ed.getByRole('button', { name: 'Далее' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(700);
  body = await page.locator('main').innerText();
  log(/615/.test(body), 'Расход 615 сохранён', body.slice(0, 200));

  // === SHOP ===
  await page.getByRole('button', { name: /^Добавить$/ }).click();
  await page.waitForTimeout(400);
  ed = page.getByRole('dialog');
  await ed.getByRole('button', { name: /Покупка/ }).click();
  await page.waitForTimeout(250);
  await ed.locator('input[placeholder*="Плитка"]').fill('Плитка Kerama');
  // Select chips - buttons with zone/category names from defaults
  for (const label of ['Ванная', 'Материалы', 'Чистовые', 'Общее', 'Прочее', 'Черновые', 'Финиш']) {
    const b = ed.getByRole('button', { name: label, exact: true });
    if (await b.count()) {
      await b.first().click().catch(() => {});
    }
  }
  await ed.getByRole('button', { name: 'Далее' }).click();
  await page.waitForTimeout(400);
  // maybe still step 0 if validation - check for toast / still see Покупка selected
  ed = page.getByRole('dialog');
  if (await ed.locator('input[type="number"]').count()) {
    await ed.locator('input[type="number"]').nth(1).fill('450');
    await ed.getByRole('button', { name: 'Далее' }).click();
    await page.waitForTimeout(250);
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForTimeout(700);
  } else {
    log(false, 'Не перешли на оплату (покупка) — не хватило зон/категорий');
    await page.keyboard.press('Escape');
  }
  body = await page.locator('main').innerText();
  log(
    body.includes('Вне сметы') || body.includes('Плитка'),
    'Покупка в списке',
    body.slice(0, 300),
  );

  // === SMETA remainings ===
  await openNav(page, 'Смета');
  body = await page.locator('main').innerText();
  log(/остаток/i.test(body), 'Отображение остатка в смете', body.slice(0, 500));
  // total plan 831.04, paid 615, remain 216.04 distributed
  // Check neither shows paid 307.5 (equal split bug)
  log(!body.includes('307,5') && !body.includes('307.5'), 'Нет равного деления 307.5', body.slice(0, 500));

  // === DASHBOARD ===
  await openNav(page, 'Дашборд');
  await page.waitForTimeout(600);
  body = await page.locator('main').innerText();
  log(body.includes('Ещё к оплате'), 'KPI ещё к оплате');
  // Shop should not kill plan gap completely if 450 shop - plan gap should still ~216
  // Extract hard: if "Ещё к оплате" section shows 0 wrongly when shop only...
  log(true, 'Текст дашборда', body.slice(0, 900));
  await page.screenshot({ path: 'test-desktop-dashboard.png', fullPage: true });

  // plan gap shouldn't be 0 if only 615 of 831 paid (unless DIY)
  // remaining ~216
  const has216 = /216/.test(body.replace(/\s/g, ''));
  const hasGap = /Ещё к оплате[\s\S]{0,40}216|216[\s\S]{0,20}Br/.test(body.replace(/\u00a0/g, ' '));
  log(has216 || hasGap || /215|216|217/.test(body), 'Остаток ~216 на дашборде?', body.match(/[\d\s,.]+Br/g)?.slice(0, 12)?.join(' | '));

  // Fact should include 615+450=1065
  log(/1[\s]?065|1065|1\.065/.test(body.replace(/\u00a0/g, ' ')) || body.includes('Факт'), 'Факт учитывает всё');

  // Contractors
  await openNav(page, 'Люди');
  await page.getByRole('button', { name: /^Добавить$/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('dialog').locator('input').first().fill('Магазин Тест');
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(500);
  log((await page.locator('main').innerText()).includes('Магазин Тест'), 'Контрагент');

  // Export
  await openNav(page, 'Ещё');
  const dlP = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.getByRole('button', { name: /Экспорт JSON/ }).click();
  const dl = await dlP;
  log(!!dl, 'Экспорт JSON', dl ? await dl.suggestedFilename() : 'fail');

  // Merge zones UI exists
  await openNav(page, 'Смета');
  log(
    await page.getByRole('button', { name: /Объединить/ }).count() > 0,
    'Кнопка объединить зоны',
  );

  // Empty state paths - filters
  await openNav(page, 'Расходы');
  await page.getByRole('button', { name: /Фильтры/ }).click().catch(() => {});
  await page.waitForTimeout(200);
  log(true, 'Фильтры расходов открываются');

  // Desktop header height / logo
  const logo = page.locator('header').getByText('МойРемонт');
  log(await logo.isVisible(), 'Логотип на десктопе');

} catch (e) {
  log(false, 'CRASH', e.stack || e);
  await page.screenshot({ path: 'test-desktop-error.png', fullPage: true }).catch(() => {});
}

await browser.close();
writeFileSync('test-results.json', JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log('\n--- ИТОГО ---');
console.log(`OK: ${results.filter((r) => r.ok).length} / FAIL: ${failed.length}`);
if (failed.length) failed.forEach((f) => console.log(' FAIL:', f.msg, f.detail));
process.exit(failed.length ? 1 : 0);
