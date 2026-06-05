import fs from 'node:fs';

const targets = [
  'coverage',
  'playwright-report',
  'test-results',
  'dist',
  'reports',
  '.stryker-tmp',
  'store-assets/output',
  'web-ext-artifacts',
];

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}

for (const entry of fs.readdirSync('.')) {
  if (entry.endsWith('.zip')) {
    fs.rmSync(entry, { force: true });
  }
}
