import { defineConfig } from 'vitest/config'
import path from 'path'
import { randomBytes } from 'node:crypto'

// Unmocked unit clients get an unreachable disposable target, never .env.
// Integration runs receive a real identity exclusively from the provisioner.
const isolated = process.env.TEST_RUN_ID
const unitRunId = randomBytes(16).toString('hex')

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: isolated ? {} : {
      TEST_RUN_ID: unitRunId,
      TEST_DATABASE_URL: `postgresql://ecommerce_test:unit@127.0.0.1:1/ecommerce_test_${unitRunId}?connect_timeout=1`,
      DATABASE_URL: `postgresql://ecommerce_test:unit@127.0.0.1:1/ecommerce_test_${unitRunId}?connect_timeout=1`,
      DIRECT_URL: `postgresql://ecommerce_test:unit@127.0.0.1:1/ecommerce_test_${unitRunId}?connect_timeout=1`,
    },
    fileParallelism: !isolated,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
