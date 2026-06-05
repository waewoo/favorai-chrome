import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    reporters: isGitHubActions
      ? ['github-actions', ['junit', { suiteName: 'Unit tests' }]]
      : ['default'],
    outputFile: isGitHubActions
      ? {
          junit: 'reports/unit-tests.xml'
        }
      : undefined,
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', '**/.stryker-tmp/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: [
        'tests/**',
        'src/background/analysis.js',
        'src/background/orchestrator.js',
        'src/popup/**',
        'src/llm/providers/**'
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
