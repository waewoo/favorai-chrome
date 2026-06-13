const sections = [
  {
    title: 'Setup',
    items: [
      ['install', 'Install project dependencies (npm install)'],
      ['install-ci', 'Install dependencies for CI (npm ci --ignore-scripts)'],
      ['install-hooks', '(Re)generate Husky hooks via npm run prepare'],
      ['install-codegraph', 'Install and initialize CodeGraph for local indexing'],
    ],
  },
  {
    title: 'Quality',
    items: [
      ['lint', 'Run ESLint code validation checks'],
      ['lint-fix', 'Auto-fix linter warnings and format issues'],
      ['test', 'Run all Vitest unit tests'],
      ['test-watch', 'Run Vitest in interactive watch mode'],
      ['test-coverage', 'Run unit tests and print a coverage summary'],
      ['test-mutation', 'Run mutation testing to validate test strength'],
      ['security', 'Run dependency, static analysis, extension, and secret scans'],
      ['check-deps', 'Show outdated devDependencies with current vs latest versions'],
      ['update-deps', 'Upgrade all devDependencies to the latest versions'],
    ],
  },
  {
    title: 'E2E',
    items: [
      ['test-e2e', 'Run the full Playwright suite (UI + integration)'],
      ['test-e2e-ui', 'Run the Playwright UI suite only'],
      ['test-e2e-integration', 'Run the Playwright integration suite only'],
    ],
  },
  {
    title: 'Release',
    items: [
      ['bump', 'Auto-detect the SemVer bump type, update the changelog, commit/tag, package, and create the GitHub release when gh is authenticated'],
      ['bump-patch', 'Increment the patch version manually'],
      ['bump-minor', 'Increment the minor version manually'],
      ['bump-major', 'Increment the major version manually'],
      ['release', 'Recreate or update the GitHub release for the current version/tag'],
      ['package', 'Package the extension into a ZIP file'],
      ['screenshots', 'Generate store asset PNGs from HTML sources'],
      ['upload', 'Upload the ZIP to the Chrome Web Store as a draft update'],
      ['publish', 'Upload and publish to all users on the Chrome Web Store'],
      ['publish-testers', 'Upload and publish to trusted testers on the Chrome Web Store'],
    ],
  },
  {
    title: 'Cleanup',
    items: [
      ['clean', 'Remove build, test, mutation, and generated asset outputs'],
      ['clean-e2e', 'Remove leftover Playwright reports and temporary directories'],
      ['kill-e2e', 'Kill stuck Playwright or Chrome processes'],
    ],
  },
];

const title = 'FavorAI Bookmark Manager Extension - Available Commands';
const commandWidth = sections
  .flatMap((section) => section.items)
  .reduce((max, [command]) => Math.max(max, `make ${command}`.length), 0);
const lineWidth = Math.max(76, title.length + 2);
const border = '='.repeat(lineWidth);

console.log(border);
console.log(` ${title}`);
console.log(border);
console.log('');

for (const section of sections) {
  console.log(section.title);
  console.log('-'.repeat(section.title.length));
  for (const [command, description] of section.items) {
    const label = `make ${command}`.padEnd(commandWidth + 2);
    console.log(`  ${label}${description}`);
  }
  console.log('');
}
