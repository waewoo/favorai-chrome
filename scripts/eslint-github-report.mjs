import fs from 'node:fs';
import path from 'node:path';

const reportPath = process.argv[2] ?? 'reports/eslint.json';

if (!fs.existsSync(reportPath)) {
  console.log(`ESLint report not found at ${reportPath}.`);
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const escapeCommandValue = (value) =>
  String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');

let errorCount = 0;
let warningCount = 0;
let fileCount = 0;

for (const result of results) {
  if (!result.messages?.length) {
    continue;
  }

  fileCount += 1;
  const relativePath = path.relative(process.cwd(), result.filePath) || result.filePath;

  for (const message of result.messages) {
    const severity = message.severity === 2 ? 'error' : 'warning';
    const line = message.line ?? 1;
    const column = message.column ?? 1;
    const ruleId = message.ruleId ? ` (${message.ruleId})` : '';
    const title = message.ruleId ? `ESLint ${message.ruleId}` : 'ESLint';
    const workflowCommand = [
      severity,
      `file=${escapeCommandValue(relativePath)}`,
      `line=${line}`,
      `col=${column}`,
      `title=${escapeCommandValue(title)}`
    ].join(',');

    console.log(`::${workflowCommand}::${escapeCommandValue(`${message.message}${ruleId}`)}`);

    if (severity === 'error') {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
  }
}

console.log(`ESLint findings processed: ${errorCount} errors, ${warningCount} warnings.`);
console.log(`ESLint files with findings: ${fileCount}.`);
