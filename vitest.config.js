import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
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
      ]
    }
  }
});
