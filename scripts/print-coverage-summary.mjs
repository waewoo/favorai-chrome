import fs from 'node:fs';

const summaryPath = 'coverage/coverage-summary.json';

if (!fs.existsSync(summaryPath)) {
  console.log('Coverage summary not found. Run `make test-coverage` first.');
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const metrics = [
  ['Statements', summary.total.statements],
  ['Branches', summary.total.branches],
  ['Functions', summary.total.functions],
  ['Lines', summary.total.lines],
];
const labelWidth = Math.max(...metrics.map(([label]) => label.length));

console.log('');
console.log('======================================================');
console.log(' GLOBAL COVERAGE SUMMARY:');
for (const [label, data] of metrics) {
  const paddedLabel = label.padEnd(labelWidth);
  console.log(`  ${paddedLabel}: ${String(data.pct).padStart(5)}% (${data.covered}/${data.total})`);
}
console.log('======================================================');
console.log('');
