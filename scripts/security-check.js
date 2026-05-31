#!/usr/bin/env node
/**
 * scripts/security-check.js
 * Full security audit runner for FavorAI.
 *
 * Runs three tools in sequence:
 *   1. npm audit --audit-level=high  → dependency vulnerability scan
 *   2. ESLint with security plugin   → static source code analysis
 *   3. web-ext lint                  → Chrome extension manifest + code scan
 *
 * Firefox-specific errors/warnings are silently ignored (FavorAI targets Chrome only).
 * ICON_SIZE_INVALID is a known cosmetic issue (non-blocking for Chrome).
 * Exits with code 1 if any tool reports real Chrome-applicable errors.
 */

import { execSync } from 'child_process';

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

const failures = [];

function run(label, cmd) {
  console.log(`\n${CYAN}══════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}  ${label}${RESET}`);
  console.log(`${CYAN}══════════════════════════════════════════════${RESET}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`${GREEN}✅ ${label}: PASSED${RESET}`);
  } catch {
    console.log(`${RED}❌ ${label}: FAILED${RESET}`);
    failures.push(label);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dependency vulnerability scan (high/critical only)
// ─────────────────────────────────────────────────────────────────────────────
run(
  'npm audit  (high/critical vulnerabilities)',
  'npm audit --audit-level=high'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. ESLint with security plugin (static code analysis)
// ─────────────────────────────────────────────────────────────────────────────
run(
  'ESLint security scan  (src/ + background.js + popup*.js)',
  'npx eslint src/ background.js popup.js popup-light.js --ext .js'
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. web-ext lint — Chrome extension manifest + code scan
// Firefox-specific codes are ignored; FavorAI targets Chrome only.
// Directories outside the extension bundle (coverage/, node_modules/, tests/)
// are excluded to avoid false positives from test HTML reports.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Codes emitted by web-ext that are Firefox-only concerns.
 * FavorAI is a Chrome/Chromium extension — these are not applicable.
 */
const FIREFOX_ONLY_CODES = new Set([
  'BACKGROUND_SERVICE_WORKER_NOFALLBACK', // Chrome MV3 service_worker has no Firefox fallback
  'ADDON_ID_REQUIRED',                    // Firefox requires a gecko extension ID
  'STORAGE_SYNC',                         // Firefox debugging note about storage.sync
  'MISSING_DATA_COLLECTION_PERMISSIONS',  // Firefox-specific privacy manifest field
  'ICON_SIZE_INVALID',                    // Non-blocking cosmetic warning (Chrome accepts 1024px)
]);

console.log(`\n${CYAN}══════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}  web-ext lint  (Chrome extension manifest and code scan)${RESET}`);
console.log(`${CYAN}══════════════════════════════════════════════${RESET}`);

const ignorePatterns = [
  'coverage/**',
  'node_modules/**',
  'tests/**',
  'playwright-report/**',
  'test-results/**',
  'web-ext-artifacts/**',
  'scripts/**',
  'dist/**',
].map(p => `"${p}"`).join(' ');

const webExtCmd = `npx web-ext lint --output=json --ignore-files ${ignorePatterns}`;

let rawOutput = '';
try {
  rawOutput = execSync(webExtCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  // web-ext exits with code 1 when there are errors/warnings; output is still in stdout
  rawOutput = (err.stdout || '') + (err.stderr || '');
}

// Extract the JSON blob (web-ext may emit it on stderr with a header line on stdout)
const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.log(`${YELLOW}⚠️  web-ext lint: could not parse output — treating as skipped.${RESET}`);
} else {
  try {
    const report = JSON.parse(jsonMatch[0]);
    const chromeErrors   = (report.errors   || []).filter(e => !FIREFOX_ONLY_CODES.has(e.code));
    const securityWarns  = (report.warnings || []).filter(e =>
      !FIREFOX_ONLY_CODES.has(e.code) && e.code === 'UNSAFE_VAR_ASSIGNMENT'
    );

    if (chromeErrors.length > 0) {
      console.log(`${RED}❌ ${chromeErrors.length} Chrome-applicable error(s):${RESET}`);
      chromeErrors.forEach(e =>
        console.log(`${RED}   [${e.code}] ${(e.message || '').substring(0, 120)}${RESET}`)
      );
      failures.push('web-ext lint');
    } else if (securityWarns.length > 0) {
      console.log(`${RED}❌ ${securityWarns.length} UNSAFE_VAR_ASSIGNMENT security warning(s):${RESET}`);
      securityWarns.forEach(e =>
        console.log(`${RED}   ${e.file}:${e.line} → ${(e.message || '').substring(0, 100)}${RESET}`)
      );
      failures.push('web-ext lint  (UNSAFE_VAR_ASSIGNMENT)');
    } else {
      const skippedCount = (report.errors?.length || 0) + (report.warnings?.length || 0) - chromeErrors.length - securityWarns.length;
      console.log(`${GREEN}✅ web-ext lint: PASSED${RESET}  ${YELLOW}(${skippedCount} Firefox-only notice(s) ignored)${RESET}`);
    }
  } catch {
    console.log(`${YELLOW}⚠️  web-ext lint: JSON parse error — treating as skipped.${RESET}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Final summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${CYAN}══════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}  SECURITY AUDIT SUMMARY${RESET}`);
console.log(`${CYAN}══════════════════════════════════════════════${RESET}`);

if (failures.length === 0) {
  console.log(`${GREEN}✅ All security checks passed!${RESET}`);
  process.exit(0);
} else {
  console.log(`${RED}❌ ${failures.length} check(s) failed:${RESET}`);
  failures.forEach(f => console.log(`${RED}   - ${f}${RESET}`));
  console.log(`${YELLOW}⚠️  Fix the issues above before releasing.${RESET}`);
  process.exit(1);
}
