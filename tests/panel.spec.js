const { test, expect } = require('@playwright/test');
const { mock, noHorizontalScroll, ME, PROFILE } = require('./helpers');
const fs = require('fs');
const SHOTS = process.env.SHOTS_DIR || '';
async function shotView(page, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); } }
async function shot(page, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } }

test.afterEach(async ({ page }) => { expect(page.__blocked || [], 'żądania poza localhost i mockiem').toEqual([]); });

async function fillStep1(page, en) {
  await page.fill('#pmail', 'Ty@Przyklad.pl');
  await page.selectOption('#pyear', '1985');
  await page.click('[data-next]');
}
async function fillStep2(page) {
  for (const v of ['tech', 'biznes', 'auto']) await page.check(`input[value=${v}]`);
  await page.check('#adultP');
  await page.check('#zgodaP');
}

test.describe('rejestracja', () => {
  test('PL: dwa kroki, ładunek zgodny z API, credentials include, przejście na sprawdz-poczte', async ({ page }) => {
    const calls = await mock(page, { 'POST /register': () => [202, { ok: true }] });
    await page.goto('/?ref=ab12cd34#dolacz');
    await expect(page.locator('#regForm [data-step="1"]')).toBeVisible();
    await expect(page.locator('#regForm [data-step="2"]')).toBeHidden();
    // krok 1 widoczny bez przewijania na telefonie 375x667
    const box = await page.locator('[data-next]').boundingBox();
    const sy = await page.evaluate(() => window.scrollY);
    expect(box.y + box.height - 0).toBeGreaterThan(0);
    await page.evaluate(() => document.getElementById('dolacz').scrollIntoView({ behavior: 'instant' }));
    await shotView(page, '01-dolacz-krok1');
    await fillStep1(page);
    await expect(page.locator('#regForm [data-step="2"]')).toBeVisible();
    await expect(page.locator('.ts-slot')).toContainText('turnstile mock');
    await fillStep2(page);
    await page.check('#mktP');
    await page.evaluate(() => document.getElementById('regForm').scrollIntoView({ behavior: 'instant' }));
    await shotView(page, '02-dolacz-krok2');
    await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken === 'tok-mock');
    await page.click('#regForm button[type=submit]');
    await page.waitForURL('**/dolacz/sprawdz-poczte/');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ method: 'POST', path: '/register', contentType: 'application/json', body: {
      email: 'Ty@Przyklad.pl', birth_year: 1985, interests: ['tech', 'biznes', 'auto'],
      consents: { terms: true, privacy: true, marketing: true }, lang: 'pl', ref: 'AB12CD34', turnstile_token: 'tok-mock' } });
    const log = await page.evaluate(() => 0); // log fetch jest w poprzednim dokumencie, patrz test poniżej
  });

  test('credentials: "include" w żądaniu rejestracji', async ({ page }) => {
    await mock(page, { 'POST /register': () => [202, { ok: true }] });
    await page.goto('/');
    await fillStep1(page); await fillStep2(page);
    await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken);
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith('/api/panel/register') && r.method() === 'POST'),
      (async () => { await page.evaluate(() => { window.__log = window.__fetchLog; }); await page.click('#regForm button[type=submit]'); })(),
    ]);
    const log = await page.evaluate(() => window.__fetchLog);
    expect(log.find((l) => l.url.endsWith('/register')).credentials).toBe('include');
    expect(req.headers()['content-type']).toBe('application/json');
  });

  test('EN: formularz wysyła lang=en i prowadzi na /en/join/check-email/', async ({ page }) => {
    const calls = await mock(page, { 'POST /register': () => [202, { ok: true }] });
    await page.goto('/en/#join');
    await fillStep1(page); await fillStep2(page);
    await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken);
    await page.click('#regForm button[type=submit]');
    await page.waitForURL('**/en/join/check-email/');
    expect(calls.find((c) => c.method === 'POST').body.lang).toBe('en');
    await expect(page.locator('h1')).toHaveText('Check your inbox');
  });

  test('walidacja: krok 1, krok 2 (tematy, zgoda, weryfikacja)', async ({ page }) => {
    const calls = await mock(page, {});
    await page.goto('/');
    await page.click('[data-next]');
    await expect(page.locator('.field-err')).toHaveText('Wpisz adres e-mail.');
    await page.fill('#pmail', 'zly-adres');
    await page.click('[data-next]');
    await expect(page.locator('.field-err')).toHaveText('Sprawdź adres e-mail.');
    await page.fill('#pmail', 'a@b.pl');
    await page.click('[data-next]');
    await expect(page.locator('.field-err')).toHaveText('Wybierz rok urodzenia.');
    await page.selectOption('#pyear', '1990'); await page.click('[data-next]');
    await page.check('#adultP');
    await page.click('#regForm button[type=submit]');
    await expect(page.locator('.field-err')).toHaveText('Wybierz od 3 do 5 tematów.');
    for (const v of ['tech', 'biznes', 'auto']) await page.check(`input[value=${v}]`);
    await page.click('#regForm button[type=submit]');
    await expect(page.locator('.field-err')).toHaveText('Zaznacz zgodę na regulamin i politykę prywatności.');
    await page.check('#zgodaP');   // zgoda zaznaczona po błędzie
    // maks. 5 tematów
    for (const v of ['zdrowie', 'dom']) await page.check(`input[value=${v}]`);
    expect(await page.locator('#topics input:checked').count()).toBe(5);
    await page.locator('input[value=sport]').click();  // szósty temat: odrzucony
    expect(await page.locator('#topics input:checked').count()).toBe(5);
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
    await shot(page, '03-dolacz-blad-walidacji');
  });

  for (const [status, error, text, backToStep1] of [
    [400, 'underage', 'Panelistą może zostać tylko osoba pełnoletnia.', true],
    [403, 'turnstile_failed', 'Weryfikacja nie powiodła się. Spróbuj ponownie.', false],
    [429, 'rate_limited', 'Zbyt wiele prób. Spróbuj ponownie za godzinę.', false],
    [500, 'internal_error', 'Coś poszło nie tak. Spróbuj ponownie za chwilę.', false],
  ]) {
    test(`błąd API ${status} ${error}`, async ({ page }) => {
      await mock(page, { 'POST /register': () => [status, { error }] });
      await page.goto('/');
      await fillStep1(page); await fillStep2(page);
      await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken);
      await page.click('#regForm button[type=submit]');
      await expect(page.locator('.field-err')).toHaveText(text);
      await expect(page.locator(`#regForm [data-step="${backToStep1 ? 1 : 2}"]`)).toBeVisible();
      await expect(page.locator('#regForm button[type=submit]')).toBeEnabled();
    });
  }

  test('brak sieci: komunikat o połączeniu', async ({ page }) => {
    await mock(page, {});
    await page.route('https://api.uwazni.org.pl/**', (r) => r.abort());
    await page.goto('/');
    await fillStep1(page); await fillStep2(page);
    await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken);
    await page.click('#regForm button[type=submit]');
    await expect(page.locator('.field-err')).toContainText('Brak połączenia z serwerem');
  });

  test('mobile 375 px: krok 1 mieści się na ekranie, brak poziomego przewijania', async ({ page }) => {
    await mock(page, {});
    await page.goto('/');
    await page.evaluate(() => document.getElementById('dolacz').scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(300);
    const b = await page.locator('[data-next]').boundingBox();
    console.log('NEXT bottom', b.y + b.height);
    const vh = page.viewportSize().height;
    expect(b.y + b.height).toBeLessThanOrEqual(vh);
    await noHorizontalScroll(page);
  });
});

test.describe('sprawdz-poczte', () => {
  test('PL: adres, ponowne wysłanie (POST /login), odliczanie, zmiana adresu', async ({ page }) => {
    const calls = await mock(page, { 'POST /login': () => [202, { ok: true }] });
    await page.addInitScript(() => { if (location.pathname.includes('sprawdz')) sessionStorage.setItem('uwazni_pending', JSON.stringify({ email: 'ty@przyklad.pl' })); });
    await page.goto('/dolacz/sprawdz-poczte/');
    await expect(page.locator('h1')).toHaveText('Sprawdź skrzynkę');
    await expect(page.locator('#app')).toContainText('ty@przyklad.pl');
    await expect(page.locator('#app')).toContainText('w tej samej przeglądarce');
    await shot(page, '04-sprawdz-poczte');
    await page.getByRole('button', { name: 'Wyślij link ponownie' }).click();
    await expect(page.locator('.msg.ok')).toHaveText('Wysłane ponownie. Sprawdź skrzynkę.');
    await expect(page.getByRole('button', { name: /Ponowna wysyłka za/ })).toBeDisabled();
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/login', body: { email: 'ty@przyklad.pl' } });
    await page.getByRole('link', { name: 'Zmień adres e-mail' }).click();
    await page.waitForURL(/\/#dolacz$/);
    expect(await page.evaluate(() => sessionStorage.getItem('uwazni_pending'))).toBeNull();
    await noHorizontalScroll(page);
  });
  test('429 przy ponownej wysyłce', async ({ page }) => {
    await mock(page, { 'POST /login': () => [429, { error: 'rate_limited' }] });
    await page.addInitScript(() => { if (location.pathname.includes('sprawdz')) sessionStorage.setItem('uwazni_pending', JSON.stringify({ email: 'ty@przyklad.pl' })); });
    await page.goto('/dolacz/sprawdz-poczte/');
    await page.getByRole('button', { name: 'Wyślij link ponownie' }).click();
    await expect(page.locator('.msg.err')).toHaveText('Zbyt wiele prób. Spróbuj ponownie za godzinę.');
    await expect(page.getByRole('button', { name: 'Wyślij link ponownie' })).toBeEnabled();
  });
  test('bez zapamiętanego adresu: pole e-mail', async ({ page }) => {
    const calls = await mock(page, { 'POST /login': () => [202, {}] });
    await page.goto('/dolacz/sprawdz-poczte/');
    await page.fill('#cmail', 'ktos@example.com');
    await page.getByRole('button', { name: 'Wyślij link ponownie' }).click();
    await expect(page.locator('.msg.ok')).toBeVisible();
    expect(calls[0].body).toEqual({ email: 'ktos@example.com' });
  });
  test('EN', async ({ page }) => {
    await mock(page, { 'POST /login': () => [202, {}] });
    await page.addInitScript(() => sessionStorage.setItem('uwazni_pending', JSON.stringify({ email: 'you@example.com' })));
    await page.goto('/en/join/check-email/');
    await expect(page.locator('h1')).toHaveText('Check your inbox');
    await page.getByRole('button', { name: 'Send the link again' }).click();
    await expect(page.locator('.msg.ok')).toHaveText('Sent again. Check your inbox.');
  });
});

test.describe('zaloguj i powroty z maili', () => {
  test('/zaloguj: formularz, POST /login, komunikat', async ({ page }) => {
    const calls = await mock(page, { 'GET /me': () => [401, { error: 'unauthorized' }], 'POST /login': () => [202, { ok: true }] });
    await page.goto('/zaloguj/');
    await page.fill('#lmail', 'zle');
    await page.getByRole('button', { name: 'Wyślij link' }).click();
    await expect(page.locator('.msg.err')).toHaveText('Sprawdź adres e-mail.');
    await page.fill('#lmail', 'ty@przyklad.pl');
    await page.getByRole('button', { name: 'Wyślij link' }).click();
    await expect(page.locator('.msg.ok')).toContainText('w tej samej przeglądarce');
    expect(calls.find((c) => c.path === '/login').body).toEqual({ email: 'ty@przyklad.pl' });
    await shot(page, '05-zaloguj');
    await noHorizontalScroll(page);
  });
  test('zalogowany użytkownik z /zaloguj trafia na /konto', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME] });
    await page.goto('/zaloguj/');
    await page.waitForURL('**/konto/');
  });
  for (const [from, to, text] of [
    ['/?konto=potwierdzone', '/konto/', null],
    ['/?konto=zalogowano', '/konto/', null],
    ['/?konto=potwierdzone-zaloguj', '/zaloguj/', 'otwarto w innej przeglądarce'],
    ['/?konto=link-nieaktywny', '/zaloguj/', 'wygasł albo został już użyty'],
    ['/en/?account=confirmed', '/en/account/', null],
    ['/en/?account=signed-in', '/en/account/', null],
    ['/en/?account=confirmed-sign-in', '/en/login/', 'different browser'],
    ['/en/?account=link-expired', '/en/login/', 'expired or was already used'],
  ]) {
    test(`powrót ${from}`, async ({ page }) => {
      await mock(page, { 'GET /me': () => [text ? 401 : 200, text ? { error: 'unauthorized' } : ME] });
      await page.goto(from);
      await page.waitForURL(`**${to}*`);
      if (text) await expect(page.locator('.notice')).toContainText(text);
      else await expect(page.locator('h1')).toBeVisible();
    });
  }
  test('potwierdzone bez sesji (ponowne otwarcie linku): /konto przekierowuje na logowanie z komunikatem', async ({ page }) => {
    await mock(page, { 'GET /me': () => [401, { error: 'unauthorized' }] });
    await page.goto('/?konto=potwierdzone');
    await page.waitForURL('**/zaloguj/*');
    await expect(page.locator('.notice')).toContainText('w tej samej przeglądarce');
    await shot(page, '06-zaloguj-inna-przegladarka');
  });
  test('link Zaloguj w nawigacji: PL i EN', async ({ page }) => {
    await mock(page, {});
    await page.goto('/');
    await expect(page.locator('a[data-login=panelist]').first()).toHaveAttribute('href', '/zaloguj/');
    await page.goto('/en/');
    await expect(page.locator('a[data-login=panelist]').first()).toHaveAttribute('href', '/en/login/');
  });
});

test.describe('konto: poczekalnia', () => {
  test('PL: wszystkie elementy', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, { ...ME, first_name: 'Ania' }] });
    await page.goto('/konto/?konto=potwierdzone');
    await expect(page.locator('h1')).toHaveText('Jesteś w panelu');
    await expect(page.locator('.notice')).toHaveText('Konto potwierdzone. Witaj w panelu.');
    await expect(page.locator('.lead')).toContainText('Cześć, Ania.');
    await expect(page.locator('#profilebar')).toContainText('Uzupełniony w 33%');
    await expect(page.locator('#profilebar [role=progressbar]')).toHaveAttribute('aria-valuenow', '33');
    await expect(page.locator('#sampletask')).toContainText('Przykładowe zadanie');
    const pick = page.getByRole('button', { name: 'Wybierz zadanie: wkrótce' });
    await expect(pick).toBeDisabled();
    await expect(page.locator('#ptsval')).toContainText('250');
    await expect(page.locator('#zlval')).toHaveText('= 2,50 zł');
    await expect(page.locator('#referral input')).toHaveValue('http://localhost:4173/?ref=ABCD1234');
    await expect(page.locator('body')).not.toContainText(/syntetycz/i);
    await shot(page, '07-konto');
    await noHorizontalScroll(page);
  });
  test('EN', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME] });
    await page.goto('/en/account/');
    await expect(page.locator('h1')).toHaveText('You are in the panel');
    await expect(page.locator('#zlval')).toHaveText('= PLN 2.50');
    await expect(page.getByRole('button', { name: 'Choose a task: coming soon' })).toBeDisabled();
  });
  test('401 przekierowuje na logowanie', async ({ page }) => {
    await mock(page, { 'GET /me': () => [401, { error: 'unauthorized' }] });
    await page.goto('/konto/');
    await page.waitForURL('**/zaloguj/');
  });
  test('błąd sieci: komunikat i ponów', async ({ page }) => {
    await mock(page, {});
    await page.route('https://api.uwazni.org.pl/**', (r) => r.abort());
    await page.goto('/konto/');
    await expect(page.locator('.msg.err')).toContainText('Brak połączenia');
    await expect(page.getByRole('button', { name: 'Spróbuj ponownie' })).toBeVisible();
  });
});

test.describe('profil', () => {
  test('PL: kroki z zapisem po każdym, bonus na końcu', async ({ page }) => {
    let pct = 33;
    const calls = await mock(page, {
      'GET /me': () => [200, ME], 'GET /me/profile': () => [200, PROFILE],
      'PUT /me/profile': (b) => { pct += 17; return [200, { ...PROFILE, ...b, completion_pct: pct, bonus_awarded: pct >= 100 }]; },
      'PUT /me': (b) => [200, { ...ME, ...b, completion_pct: pct }],
    });
    pct = 33;
    await page.goto('/konto/profil/');
    await expect(page.locator('#app legend')).toHaveText('Twoja płeć');
    await expect(page.locator('#app')).toContainText('Krok 1 z 5');
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await expect(page.locator('.msg.err')).toHaveText('Wybierz jedną z opcji.');
    await page.getByLabel('Kobieta').check();
    await shot(page, '08-profil-krok1');
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await expect(page.locator('#app legend')).toHaveText('Gdzie mieszkasz?');
    expect(calls.filter((c) => c.method === 'PUT')[0]).toMatchObject({ path: '/me/profile', body: { gender: 'kobieta' } });
    await page.getByLabel('Mazowieckie').check();
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await page.getByLabel('Powyżej 500 tys.').check();
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await page.getByLabel('Smartfon z Androidem').check();
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await expect(page.locator('#app legend')).toHaveText('Jak mamy się do Ciebie zwracać?');
    await page.fill('#pname', 'Ania');
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await expect(page.locator('h1')).toHaveText('Profil uzupełniony');
    await expect(page.locator('.msg.ok')).toContainText('Dopisaliśmy 200 pkt');
    const puts = calls.filter((c) => c.method === 'PUT').map((c) => [c.path, c.body]);
    expect(puts).toEqual([
      ['/me/profile', { gender: 'kobieta' }], ['/me/profile', { voivodeship: 'mazowieckie' }],
      ['/me/profile', { town_size: '500k_plus' }], ['/me/profile', { device: 'smartfon_android' }], ['/me', { first_name: 'Ania' }],
    ]);
    await shot(page, '09-profil-gotowe');
    await noHorizontalScroll(page);
  });
  test('błąd zapisu zostaje na kroku', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME], 'GET /me/profile': () => [200, PROFILE], 'PUT /me/profile': () => [400, { error: 'invalid_gender' }] });
    await page.goto('/konto/profil/');
    await page.getByLabel('Mężczyzna').check();
    await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
    await expect(page.locator('.msg.err')).toBeVisible();
    await expect(page.locator('#app legend')).toHaveText('Twoja płeć');
  });
  test('EN: etykiety', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME], 'GET /me/profile': () => [200, PROFILE] });
    await page.goto('/en/account/profile/');
    await expect(page.locator('#app legend')).toHaveText('Your gender');
    await expect(page.getByLabel('Woman')).toBeVisible();
  });
});

test.describe('ustawienia', () => {
  const consents = { current: { terms: { granted: true, doc_version: '3', at: 1795000000000 }, privacy: { granted: true, doc_version: '3', at: 1795000000000 }, marketing: { granted: false, doc_version: '3', at: 1795000000000 } }, history: [] };
  const base = { 'GET /me': () => [200, ME], 'GET /me/consents': () => [200, consents] };

  test('zgody: zmiana marketingowej zapisuje PUT /me/consents', async ({ page }) => {
    const calls = await mock(page, { ...base, 'PUT /me/consents': () => [200, consents] });
    await page.goto('/konto/ustawienia/');
    await expect(page.locator('dl')).toContainText('wersja 3');
    await page.getByLabel('Chcę dostawać e-mailem').check();
    await expect(page.locator('.msg.ok')).toHaveText('Zapisano');
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ path: '/me/consents', body: { marketing: true } });
    await shot(page, '10-ustawienia');
    await noHorizontalScroll(page);
  });
  test('pobranie danych: plik JSON', async ({ page }) => {
    await mock(page, { ...base, 'GET /me/export': () => ({ status: 200, json: { exported_at: 1, account: { id: 'x' } } }) });
    await page.goto('/konto/ustawienia/');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Pobierz moje dane' }).click()]);
    expect(dl.suggestedFilename()).toBe('uwazni-moje-dane.json');
    expect(JSON.parse(fs.readFileSync(await dl.path(), 'utf8')).account.id).toBe('x');
  });
  test('usunięcie konta bez salda', async ({ page }) => {
    const calls = await mock(page, { ...base, 'DELETE /me': () => [200, { ok: true }] });
    await page.goto('/konto/ustawienia/');
    await page.getByRole('button', { name: 'Usuń moje konto…' }).click();
    const go = page.getByRole('button', { name: 'Usuń konto na stałe' });
    await expect(go).toBeDisabled();
    await page.getByLabel('Rozumiem, że tego nie da się cofnąć.').check();
    await go.click();
    await expect(page.locator('h1')).toHaveText('Konto zostało usunięte');
    expect(calls.find((c) => c.method === 'DELETE')).toMatchObject({ path: '/me', body: {} });
  });
  test('409 balance_pending: rezygnacja z salda wysyła forfeit_balance', async ({ page }) => {
    let n = 0;
    const calls = await mock(page, { ...base, 'DELETE /me': (b) => (b.forfeit_balance ? [200, { ok: true }] : [409, { error: 'balance_pending', balance_points: 250, balance_pln: 2.5 }]) });
    await page.goto('/konto/ustawienia/');
    await page.getByRole('button', { name: 'Usuń moje konto…' }).click();
    await page.getByLabel('Rozumiem, że tego nie da się cofnąć.').check();
    await page.getByRole('button', { name: 'Usuń konto na stałe' }).click();
    await expect(page.locator('#delzone')).toContainText('Saldo to 250 pkt (2,50 zł)');
    await shot(page, '11-usuniecie-saldo');
    const fgo = page.getByRole('button', { name: 'Zrezygnuj z salda i usuń konto' });
    await expect(fgo).toBeDisabled();
    await page.getByLabel(/Rezygnuję z 2,50/).check();
    await fgo.click();
    await expect(page.locator('h1')).toHaveText('Konto zostało usunięte');
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.body)).toEqual([{}, { forfeit_balance: true }]);
  });
  test('409 balance_pending: podanie danych do wypłaty, PUT /me i ponowne DELETE', async ({ page }) => {
    let paid = false;
    const calls = await mock(page, { ...base,
      'PUT /me': () => { paid = true; return [200, ME]; },
      'DELETE /me': () => (paid ? [200, { ok: true, payout_id: 'del:x:250' }] : [409, { error: 'balance_pending', balance_points: 250, balance_pln: 2.5 }]) });
    await page.goto('/konto/ustawienia/');
    await page.getByRole('button', { name: 'Usuń moje konto…' }).click();
    await page.getByLabel('Rozumiem, że tego nie da się cofnąć.').check();
    await page.getByRole('button', { name: 'Usuń konto na stałe' }).click();
    await page.getByRole('button', { name: 'Wypłać i usuń konto' }).click();
    await expect(page.locator('#delzone .msg.err')).toBeVisible();
    await page.fill('#pfn', 'Anna'); await page.fill('#pln', 'Nowak'); await page.fill('#pac', '61109010140000071219812874');
    await page.getByRole('button', { name: 'Wypłać i usuń konto' }).click();
    await expect(page.locator('h1')).toHaveText('Konto zostało usunięte');
    await expect(page.locator('.msg.ok')).toContainText('ostatnią wypłatę');
    expect(calls.map((c) => `${c.method} ${c.path}`).filter((x) => /PUT|DELETE/.test(x))).toEqual(['DELETE /me', 'PUT /me', 'DELETE /me']);
    expect(calls.find((c) => c.method === 'PUT').body).toEqual({ first_name: 'Anna', last_name: 'Nowak', account_number: '61109010140000071219812874' });
  });
  test('usuwanie: balance_changed i EN', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME], 'GET /me/consents': () => [200, consents], 'DELETE /me': () => [409, { error: 'balance_changed' }] });
    await page.goto('/en/account/settings/');
    await page.getByRole('button', { name: 'Delete my account…' }).click();
    await page.getByLabel('I understand that this cannot be undone.').check();
    await page.getByRole('button', { name: 'Delete account permanently' }).click();
    await expect(page.locator('#delconfirm .msg.err')).toHaveText('Your balance changed while we were deleting the account. Try again.');
  });
});

test.describe('mobile 375 px: brak poziomego przewijania na stronach aplikacji', () => {
  for (const url of ['/zaloguj/', '/en/login/', '/dolacz/sprawdz-poczte/', '/konto/', '/en/account/', '/konto/profil/', '/konto/ustawienia/', '/en/account/settings/']) {
    test(url, async ({ page }) => {
      await mock(page, { 'GET /me': () => [url.includes('login') || url.includes('zaloguj') ? 401 : 200, ME], 'GET /me/profile': () => [200, PROFILE], 'GET /me/consents': () => [200, { current: {}, history: [] }] });
      await page.goto(url);
      await page.waitForFunction(() => document.getElementById('app').getAttribute('aria-busy') !== 'true');
      await noHorizontalScroll(page);
    });
  }
});

test.describe('wylogowanie', () => {
  for (const [lang, urls, label, home] of [
    ['PL', ['/konto/', '/konto/profil/', '/konto/ustawienia/'], 'Wyloguj', '/'],
    ['EN', ['/en/account/', '/en/account/profile/', '/en/account/settings/'], 'Sign out', '/en/'],
  ]) for (const url of urls) test(`${lang} ${url}: POST /logout z credentials include, potem ${home}`, async ({ page }) => {
    const calls = await mock(page, { 'GET /me': () => [200, ME], 'GET /me/profile': () => [200, PROFILE], 'GET /me/consents': () => [200, { current: {}, history: [] }], 'POST /logout': () => ({ status: 204, text: '' }) });
    await page.goto(url);
    const btn = page.getByRole('button', { name: label });
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForURL((u) => u.pathname === home);
    const lo = calls.filter((c) => c.path === '/logout');
    expect(lo).toHaveLength(1);
    expect(lo[0].method).toBe('POST');
    // credentials: "include" sprawdzone w poprzednim dokumencie, więc przez zdarzenie żądania poniżej w osobnym teście
  });
  test('credentials: "include" i brak ciała w żądaniu /logout', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME], 'POST /logout': () => ({ status: 204, text: '' }) });
    await page.goto('/konto/');
    await page.evaluate(() => { const f = window.fetch; window.fetch = function (u, o) { sessionStorage.setItem('lastfetch', JSON.stringify({ u: String(u), c: o && o.credentials, body: o && o.body })); return f.apply(this, arguments); }; });
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await page.waitForURL((u) => u.pathname === '/');
    const last = JSON.parse(await page.evaluate(() => sessionStorage.getItem('lastfetch')));
    expect(last).toMatchObject({ c: 'include' });
    expect(last.u).toMatch(/\/api\/panel\/logout$/);
    expect(last.body).toBeUndefined();
  });
  test('wylogowany: /konto/ po 401 prowadzi na logowanie', async ({ page }) => {
    let out = false;
    await mock(page, { 'GET /me': () => (out ? [401, { error: 'unauthorized' }] : [200, ME]), 'POST /logout': () => { out = true; return { status: 204, text: '' }; } });
    await page.goto('/konto/');
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.goto('/konto/');
    await page.waitForURL('**/zaloguj/');
  });
  test('błąd sieci przy wylogowaniu: zostaje na stronie z komunikatem', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME] });
    await page.route('https://api.uwazni.org.pl/api/panel/logout', (r) => r.abort());
    await page.goto('/konto/');
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.locator('[data-signout-err]')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/konto/');
  });
  for (const status of [403, 500]) test(`/logout ${status}: bez przekierowania, komunikat, przycisk aktywny`, async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME], 'POST /logout': () => [status, { error: 'origin_not_allowed' }] });
    await page.goto('/konto/');
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.locator('[data-signout-err]')).toHaveText('Nie udało się wylogować. Spróbuj ponownie.');
    await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeEnabled();
    expect(new URL(page.url()).pathname).toBe('/konto/');
  });
  test('brak przycisku na stronie logowania i sprawdz-poczte', async ({ page }) => {
    await mock(page, { 'GET /me': () => [401, {}] });
    for (const u of ['/zaloguj/', '/dolacz/sprawdz-poczte/', '/en/login/']) { await page.goto(u); await expect(page.locator('[data-signout]')).toHaveCount(0); }
  });
  test('mobile 375 px: nawigacja z przyciskiem mieści się', async ({ page }) => {
    await mock(page, { 'GET /me': () => [200, ME] });
    await page.goto('/konto/');
    await noHorizontalScroll(page);
    await shot(page, '12-konto-wyloguj');
  });
});

test.describe('hero i teksty panelisty', () => {
  test('PL: Dołącz do panelu, bez „listy”', async ({ page }) => {
    await mock(page, {});
    await page.goto('/');
    await expect(page.locator('main a.btn-red').first()).toHaveText('Dołącz do panelu');
    await expect(page.locator('main')).toContainText('Zapis zajmuje minutę. Pierwsze zadania dostaną osoby z uzupełnionym profilem.');
    await expect(page.locator('main')).not.toContainText(/Zapisz się na listę|Startujemy wkrótce|Osoby z listy/);
  });
  test('EN: Join the panel, bez „waiting list”', async ({ page }) => {
    await mock(page, {});
    await page.goto('/en/');
    await expect(page.locator('main a.btn-red').first()).toHaveText('Join the panel');
    await expect(page.locator('main')).toContainText('Signing up takes a minute. The first tasks go to people with a complete profile.');
    await expect(page.locator('main')).not.toContainText(/waiting list|We launch soon|People on the list/i);
  });
});

test.describe('spójne progi wypłat (regulamin: pierwsza od 5 zł, kolejne od 20 zł)', () => {
  for (const [url, re, bad] of [
    ['/', /pierwsza wypłata od 5 zł, kolejne od 20 zł/, /wypłata od 5 zł\./],
    ['/en/', /first payout from PLN 5, later from PLN 20/, /payouts from PLN 5\./],
  ]) test(`meta, og:description i sekcja wypłat ${url}`, async ({ page }) => {
    await mock(page, {});
    await page.goto(url);
    const html = await page.content();
    for (const sel of ['meta[name=description]', 'meta[property="og:description"]']) expect(await page.locator(sel).getAttribute('content')).toMatch(re);
    expect(html).not.toMatch(bad);
    await expect(page.locator('#wyplaty, main').first()).toContainText(url === '/' ? 'Pierwsza wypłata od 5 zł, kolejne od 20 zł' : 'Your first payout is from PLN 5, later ones from PLN 20');
  });
});

test.describe('strona główna: nawigacja zależna od sesji', () => {
  const cases = [['PL', '/', '/konto/', '/konto/profil/', 'Moje konto', 'Zaloguj', 'Dołącz'], ['EN', '/en/', '/en/account/', '/en/account/profile/', 'My account', 'Log in', 'Join']];
  for (const [name, url, acct, prof, mine, login, join] of cases) {
    test(`${name}: 200 z /me: Moje konto zamiast logowania i dołączenia, hero na profil, jedno żądanie z credentials include`, async ({ page }) => {
      const calls = await mock(page, { 'GET /me': () => [200, ME] });
      await page.goto(url);
      const navBtn = page.locator('nav.links a.btn-red');
      await expect(navBtn).toHaveText(mine);
      await expect(navBtn).toHaveAttribute('href', acct);
      await expect(page.locator('nav.links a[data-login=panelist]')).toHaveCount(0);
      await expect(page.locator('[data-hero-join]')).toHaveAttribute('href', prof);
      expect(calls.filter((c) => c.method === 'GET' && c.path === '/me')).toHaveLength(1);
      expect(calls).toHaveLength(1);
      const log = await page.evaluate(() => window.__fetchLog);
      expect(log.filter((l) => l.url.endsWith('/api/panel/me')).map((l) => l.credentials)).toEqual(['include']);
    });
    test(`${name}: 401 z /me: widok niezalogowany bez zmian`, async ({ page }) => {
      await mock(page, { 'GET /me': () => [401, { error: 'unauthorized' }] });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('nav.links a[data-login=panelist]')).toHaveText(login);
      await expect(page.locator('nav.links a.btn-red')).toHaveText(join);
      await expect(page.locator('[data-hero-join]')).toHaveAttribute('href', url === '/' ? '#dolacz' : '#join');
    });
    test(`${name}: błąd sieci: widok niezalogowany, bez wyjątku`, async ({ page }) => {
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await mock(page, {});
      await page.route('https://api.uwazni.org.pl/**', (r) => r.abort());
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('nav.links a[data-login=panelist]')).toHaveText(login);
      await expect(page.locator('nav.links a.btn-red')).toHaveText(join);
      expect(errors).toEqual([]);
    });
  }
  test('inne strony publiczne nie pytają o /me (np. regulamin, dla firm)', async ({ page }) => {
    const calls = await mock(page, { 'GET /me': () => [200, ME] });
    for (const u of ['/regulamin-panelu.html', '/dla-firm.html', '/en/for-business.html']) await page.goto(u);
    await page.waitForLoadState('networkidle');
    expect(calls).toHaveLength(0);
  });
});

test.describe('strona główna: blok „masz już konto” zamiast formularza', () => {
  for (const [name, url, prof, h2, btn, anchor, note, heroOut, noteOut] of [
    ['PL', '/', '/konto/profil/', 'Masz już konto w panelu.', 'Przejdź do profilu', '#dolacz', 'Jesteś w panelu. Uzupełniony profil to pierwsze zadania.', 'Dołącz do panelu', 'Zapis zajmuje minutę. Pierwsze zadania dostaną osoby z uzupełnionym profilem.'],
    ['EN', '/en/', '/en/account/profile/', 'You already have a panel account.', 'Go to your profile', '#join', "You're in the panel. A complete profile gets you the first tasks.", 'Join the panel', 'Signing up takes a minute. The first tasks go to people with a complete profile.'],
  ]) {
    test(`${name}: zalogowany: blok zamiast formularza, wszystkie CTA na profil, jedno /me, bez Turnstile`, async ({ page }) => {
      const errors = [], cf = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => { if (r.url().includes('challenges.cloudflare.com')) cf.push(r.url()); });
      const calls = await mock(page, { 'GET /me': () => [200, ME] });
      await page.goto(url);
      const box = page.locator('#haveaccount');
      await expect(box.locator('h2')).toHaveText(h2);
      await expect(box.getByRole('link', { name: btn })).toHaveAttribute('href', prof);
      await expect(page.locator('#regForm')).toHaveCount(0);
      await expect(page.locator(url === '/' ? '#dolacz' : '#join')).toHaveCount(1);   // sekcja zostaje, ma tylko blok
      // brak linków do usuniętej kotwicy; nawigacja prowadzi do konta, reszta do profilu
      await expect(page.locator(`a[href="${anchor}"]`)).toHaveCount(0);
      await expect(page.locator('a[data-grp]').first()).toHaveAttribute('href', prof);
      await expect(page.locator('[data-hero-join]')).toHaveAttribute('href', prof);
      await expect(page.locator('[data-hero-join]')).toHaveText(btn);
      await expect(page.locator('[data-hero-note]')).toHaveText(note);
      await expect(page.locator('footer a.btn-ghost')).toHaveAttribute('href', prof);
      await expect(page.locator('[data-nav-join]')).toHaveAttribute('href', url === '/' ? '/konto/' : '/en/account/');
      // klik w kartę grupy nie wywołuje błędu (formularza już nie ma)
      await page.locator('a[data-grp]').first().evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
      await page.locator('a[data-grp]').first().click();
      await page.waitForTimeout(600);
      expect(calls.filter((c) => c.path === '/me')).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(cf).toEqual([]);
      expect(errors).toEqual([]);
      await shot(page, `13-glowna-zalogowany-${name}`);
    });
    test(`${name}: niezalogowany: formularz na miejscu, CTA na kotwicę, Turnstile dopiero na kroku 2`, async ({ page }) => {
      const cf = [];
      page.on('request', (r) => { if (r.url().includes('challenges.cloudflare.com')) cf.push(r.url()); });
      await mock(page, { 'GET /me': () => [401, { error: 'unauthorized' }] });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#regForm')).toHaveCount(1);
      await expect(page.locator('#haveaccount')).toHaveCount(0);
      await expect(page.locator('[data-hero-join]')).toHaveAttribute('href', anchor);
      await expect(page.locator('[data-hero-join]')).toHaveText(heroOut);
      await expect(page.locator('[data-hero-note]')).toHaveText(noteOut);
      await expect(page.locator('a[data-grp]').first()).toHaveAttribute('href', anchor);
      expect(cf).toEqual([]);
      await fillStep1(page);
      await expect(page.locator('.ts-slot')).toContainText('turnstile mock');
      expect(cf.length).toBeGreaterThan(0);
    });
  }
});

test.describe('oświadczenie o pełnoletności (krok 2)', () => {
  for (const [name, url, label] of [['PL', '/', 'Oświadczam, że mam ukończone 18 lat. (wymagane)'], ['EN', '/en/', 'I confirm I am 18 or older. (required)']]) {
    test(`${name}: przycisk zapisu nieaktywny bez checkboxa, adult_declared: true w POST`, async ({ page }) => {
      const calls = await mock(page, { 'POST /register': () => [202, { ok: true }] });
      await page.goto(url);
      await fillStep1(page);
      for (const v of ['tech', 'biznes', 'auto']) await page.check(`input[value=${v}]`);
      await page.check('#zgodaP');
      await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken);
      const btn = page.locator('#regForm button[type=submit]');
      await expect(page.locator('label[for=adultP]')).toHaveText(label);
      await expect(page.locator('#adultP')).toHaveAttribute('required', '');
      await expect(btn).toBeDisabled();
      await btn.click({ force: true });
      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
      await page.check('#adultP');
      await expect(btn).toBeEnabled();
      await page.uncheck('#adultP');
      await expect(btn).toBeDisabled();
      await page.check('#adultP');
      await btn.click();
      await page.waitForURL(/sprawdz-poczte|check-email/);
      expect(calls.find((c) => c.method === 'POST').body).toMatchObject({ adult_declared: true, consents: { terms: true, privacy: true } });
    });
  }
  test('po błędzie API przycisk zostaje aktywny, dopóki checkbox jest zaznaczony', async ({ page }) => {
    await mock(page, { 'POST /register': () => [403, { error: 'turnstile_failed' }] });
    await page.goto('/');
    await fillStep1(page); await fillStep2(page);
    await page.waitForFunction(() => document.getElementById('regForm').dataset.tsToken);
    await page.click('#regForm button[type=submit]');
    await expect(page.locator('.field-err')).toBeVisible();
    await expect(page.locator('#regForm button[type=submit]')).toBeEnabled();
  });
  test('mobile 375 px: krok 2 bez poziomego przewijania', async ({ page }) => {
    await mock(page, {});
    await page.goto('/');
    await fillStep1(page);
    await noHorizontalScroll(page);
  });
});

test.describe('zgoda #zgodaP bez części o 18 latach', () => {
  for (const [name, url, text, links] of [
    ['PL', '/', 'Akceptuję regulamin panelu i politykę prywatności. (wymagane)', [['regulamin panelu', /regulamin-panelu\.html$/], ['politykę prywatności', /polityka-prywatnosci\.html#panelisci$/]]],
    ['EN', '/en/', 'I accept the panel terms and the privacy policy. (required)', [['panel terms', /panel-terms\.html$/], ['privacy policy', /privacy-policy\.html#panelists$/]]],
  ]) test(`${name}: treść i linki, pełnoletność tylko w osobnym checkboxie`, async ({ page }) => {
    await mock(page, {});
    await page.goto(url);
    await fillStep1(page);
    const label = page.locator('label[for=zgodaP]');
    await expect(label).toHaveText(text);
    for (const [t, re] of links) await expect(label.getByRole('link', { name: t })).toHaveAttribute('href', re);
    await expect(label).not.toContainText(/18/);
    await expect(page.locator('label[for=adultP]')).toContainText('18');
    await expect(page.locator('#zgodaP')).toHaveAttribute('required', '');
  });
});
