import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [
      'src/App.test.tsx',
      'src/components/GapChart.test.tsx',
      'src/components/RaceDashboard.test.tsx',
      'src/components/SessionSelector.test.tsx',
      'src/components/StandingsBoard.test.tsx',
      'src/contexts/**',
      'src/hooks/**',
      'node_modules/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
