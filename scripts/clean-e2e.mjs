import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const targets = ['test-results', 'playwright-report'];

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}

const e2eRoot = 'tests/e2e';
if (fs.existsSync(e2eRoot)) {
  for (const entry of fs.readdirSync(e2eRoot)) {
    if (entry.startsWith('tmp-user-data-')) {
      fs.rmSync(path.join(e2eRoot, entry), { recursive: true, force: true });
    }
  }
}

const tempDir = os.tmpdir();
if (fs.existsSync(tempDir)) {
  for (const entry of fs.readdirSync(tempDir)) {
    if (entry.startsWith('favorai-e2e-')) {
      fs.rmSync(path.join(tempDir, entry), { recursive: true, force: true });
    }
  }
}
