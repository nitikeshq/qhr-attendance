import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

/**
 * Browser smoke tests for the admin console.
 *
 * These exist because nothing previously rendered a page. The shell verifiers
 * check API responses and `next build` only checks that TypeScript compiles, so
 * a client-side crash reached production once already: the calendar threw on an
 * event kind that had no entry in a lookup map, which unmounted the whole tree.
 * A build and an API check both stayed green.
 *
 * Both servers are started here against a throwaway data file, so a run never
 * touches real data and needs nothing running beforehand.
 */

const backendPort = 5199
const adminPort = 3199
const dataFile = path.join(os.tmpdir(), `qhr-e2e-${process.pid}.json`)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${adminPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      // Demo tenants are wanted here: the tests sign in as the seeded admin.
      command: `node src/server.js`,
      cwd: path.join(__dirname, '..', 'attendance-mobile', 'Backend'),
      port: backendPort,
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        PORT: String(backendPort),
        HOST: '127.0.0.1',
        NODE_ENV: 'development',
        QHR_DATA_FILE: dataFile,
        ALLOWED_ORIGINS: `http://127.0.0.1:${adminPort},http://localhost:${adminPort}`,
        // Each test gets a fresh browser context and signs in again, which trips
        // the 10-attempt auth limiter partway through the suite. The limiter has
        // its own coverage in the backend tests; here it would only cause noise.
        AUTH_RATE_LIMIT_MAX_ATTEMPTS: '5000',
        RATE_LIMIT_MAX_REQUESTS: '100000',
      },
    },
    {
      // A production build, not the dev server. Dev hydrates slowly enough that a
      // click can land before React attaches its handlers, and it also blocks
      // cross-origin HMR from 127.0.0.1, which floods the console with noise the
      // tests would have to ignore. Building here also proves the bundle works.
      // NEXT_PUBLIC_* is inlined at build time, so the build needs the same env.
      command: `npx next build && npx next start -p ${adminPort}`,
      cwd: __dirname,
      port: adminPort,
      reuseExistingServer: false,
      timeout: 300000,
      env: {
        PORT: String(adminPort),
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}`,
      },
    },
  ],
})
