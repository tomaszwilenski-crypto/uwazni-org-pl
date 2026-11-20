// Testy z zamockowanym API: żadne żądanie nie wychodzi na produkcję.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  workers: 3,
  retries: 1,   // Chrome czasem nie startuje przy dużej równoległości (błąd newPage), to nie błąd testów
  reporter: 'list',
  webServer: { command: 'python3 -m http.server 4173 >/dev/null 2>&1', port: 4173, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 375, height: 667 },
    locale: 'pl-PL',
  },
});
