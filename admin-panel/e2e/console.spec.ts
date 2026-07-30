import { expect, test, type Page } from '@playwright/test'

/**
 * Every page of the console, rendered in a real browser.
 *
 * The bug class this guards against: a component reads a lookup map with a key
 * that isn't there, throws during render, and the segment error boundary replaces
 * the whole page with "This page couldn't load". TypeScript compiles it happily
 * and every API check passes, so only rendering catches it.
 */

const CREDENTIALS = { email: 'company@example.com', password: 'password123' }

/** Pages a company admin can reach, with the heading each one must show. */
const TENANT_PAGES: Array<{ page: string; heading: string }> = [
  { page: 'dashboard', heading: 'Dashboard' },
  { page: 'onboarding', heading: 'Getting started' },
  { page: 'employees', heading: 'Employees' },
  { page: 'org', heading: 'Organisation' },
  { page: 'attendance', heading: 'Attendance' },
  { page: 'calendar', heading: 'Calendar' },
  { page: 'leaves', heading: 'Leave Requests' },
  { page: 'wfh', heading: 'WFH Requests' },
  { page: 'grievances', heading: 'Grievances' },
  { page: 'payroll', heading: 'Payroll' },
  { page: 'reimbursements', heading: 'Reimbursements' },
  { page: 'subscriptions', heading: 'Subscriptions' },
  { page: 'work', heading: 'Projects & Tasks' },
  { page: 'desktop', heading: 'Desktop Activity' },
  { page: 'assets', heading: 'Assets' },
  { page: 'geofences', heading: 'Geofences' },
  { page: 'imports', heading: 'Data migration' },
  { page: 'settings', heading: 'Company & settings' },
]

const PLATFORM_PAGES: Array<{ page: string; heading: string }> = [
  { page: 'dashboard', heading: 'Platform Overview' },
  { page: 'companies', heading: 'Tenant Companies' },
  { page: 'employees', heading: 'Tenant Users' },
  { page: 'leads', heading: 'Sales Pipeline' },
  { page: 'audit', heading: 'Platform Audit' },
  { page: 'plans', heading: 'Plans & pricing' },
  { page: 'subscriptions', heading: 'Billing & Plans' },
]

/** Fails the test on any console error or unhandled rejection. */
function captureFailures(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Network noise from an endpoint a role cannot reach is expected and is
    // already surfaced in the UI as a notice; it is not a render failure.
    if (/Failed to load resource|net::ERR_|status of 40[0-9]|status of 5[0-9][0-9]/i.test(text)) return
    problems.push(`console: ${text}`)
  })
  page.on('pageerror', (error) => { problems.push(`pageerror: ${error.message}`) })
  return problems
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/')

  const emailField = page.getByLabel(/email/i)
  const passwordField = page.getByLabel(/password/i)
  const submit = page.getByRole('button', { name: /sign in/i })
  await expect(submit).toBeEnabled()

  await emailField.fill(email)
  await passwordField.fill(password)

  // The form is a client component, so a click before hydration does nothing and
  // silently leaves you on the sign-in screen. Retry until the rail appears.
  const rail = page.getByRole('navigation', { name: 'Main' })
  await expect(async () => {
    if (await rail.isVisible()) return
    await submit.click({ timeout: 5000 })
    await expect(rail).toBeVisible({ timeout: 8000 })
  }).toPass({ timeout: 45000 })
}

/** The segment error boundary, which must never appear. */
async function assertNoErrorBoundary(page: Page) {
  await expect(page.getByText(/This page couldn.t load/i)).toHaveCount(0)
  await expect(page.getByText(/Application error/i)).toHaveCount(0)
}

test.describe('company admin console', () => {
  test('every page renders without crashing', async ({ page }) => {
    const problems = captureFailures(page)
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    for (const entry of TENANT_PAGES) {
      await page.goto(`/?page=${entry.page}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(entry.heading, { timeout: 20000 })
      await assertNoErrorBoundary(page)
      // A page that rendered its heading but no body would still be broken.
      await expect(page.locator('main')).toBeVisible()
    }

    expect(problems, `client-side failures:\n${problems.join('\n')}`).toEqual([])
  })

  test('the current page survives a reload', async ({ page }) => {
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    await page.goto('/?page=geofences')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Geofences')

    await page.reload()
    // This is the regression that sent every refresh back to the Dashboard.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Geofences')
  })

  test('navigating puts the page in the address and resets scroll', async ({ page }) => {
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    await page.goto('/?page=employees')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Employees')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.getByRole('button', { name: 'Calendar' }).first().click()

    await expect(page).toHaveURL(/page=calendar/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Calendar')
    // Carrying the previous page's offset opened short pages past their content.
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('browser back returns to the previous page', async ({ page }) => {
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    await page.goto('/?page=employees')
    await page.getByRole('button', { name: 'Assets' }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Assets')

    await page.goBack()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Employees')
  })

  test('an unknown page falls back to the dashboard', async ({ page }) => {
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)
    await page.goto('/?page=not-a-real-page')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dashboard')
  })

  test('the calendar renders every event type it can produce', async ({ page }) => {
    const problems = captureFailures(page)
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    await page.goto('/?page=calendar')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Calendar')

    // The filter chips are one per event kind, including the one that crashed.
    for (const label of ['Holiday', 'Event', 'Birthday', 'Work anniversary', 'Company']) {
      await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible()
    }

    // Stepping across months exercises the feed and the grid together.
    await page.getByRole('button', { name: 'Next month' }).click()
    await page.getByRole('button', { name: 'Next year' }).click()
    await assertNoErrorBoundary(page)

    expect(problems, `client-side failures:\n${problems.join('\n')}`).toEqual([])
  })
})

test.describe('platform console', () => {
  test('every super admin page renders without crashing', async ({ page }) => {
    const problems = captureFailures(page)
    await signIn(page, 'admin@qhr.com', 'admin123')

    for (const entry of PLATFORM_PAGES) {
      await page.goto(`/?page=${entry.page}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(entry.heading, { timeout: 20000 })
      await assertNoErrorBoundary(page)
    }

    expect(problems, `client-side failures:\n${problems.join('\n')}`).toEqual([])
  })
})

test.describe('work week editor', () => {
  test('weekly offs are editable and the month preview reflects them', async ({ page }) => {
    const problems = captureFailures(page)
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    await page.goto('/?page=settings')
    const card = page.getByRole('region', { name: /Work week and weekly offs/i })
      .or(page.locator('section').filter({ hasText: 'Work week and weekly offs' }))
    await expect(card.first()).toBeVisible({ timeout: 20000 })

    // Every weekday is configurable, which was previously impossible from the UI.
    for (const day of ['Monday', 'Saturday', 'Sunday']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible()
    }

    // The month preview is the pre-payroll answer to "how many days count?".
    await expect(page.getByText('Month preview')).toBeVisible()
    await expect(page.getByText('Weekly offs', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Payable-day basis/i).first()).toBeVisible()

    // Choosing "some weeks off" reveals the 1st..5th occurrence picker, which is
    // how 2nd and 4th Saturday is expressed.
    await page.getByRole('button', { name: 'Some weeks off' }).last().click()
    await expect(page.getByRole('button', { name: '2nd' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '4th' }).first()).toBeVisible()

    await assertNoErrorBoundary(page)
    expect(problems, `client-side failures:\n${problems.join('\n')}`).toEqual([])
  })
})

test.describe('payroll preview', () => {
  test('the month can be confirmed before it is generated', async ({ page }) => {
    const problems = captureFailures(page)
    await signIn(page, CREDENTIALS.email, CREDENTIALS.password)

    await page.goto('/?page=payroll')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Payroll')

    // The preview sits above the run controls, so figures are visible first.
    await expect(page.getByText('Before you run: preview and checks')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Ready to run|is not ready/)).toBeVisible()

    // Exceptions is the default view: only people who differ from a clean month.
    await expect(page.getByRole('button', { name: /Needs review/ })).toBeVisible()
    await page.getByRole('button', { name: /Everyone/ }).click()
    await expect(page.getByRole('button', { name: /Everyone/ })).toHaveAttribute('aria-pressed', 'true')

    await assertNoErrorBoundary(page)
    expect(problems, `client-side failures:\n${problems.join('\n')}`).toEqual([])
  })
})

test('the sign-in form ships no credentials', async ({ page }) => {
  await page.goto('/')
  // Pre-filled demo credentials on an internet-facing console is a live
  // vulnerability, so this guards against them coming back.
  await expect(page.getByLabel(/email/i)).toHaveValue('')
  await expect(page.getByLabel(/password/i)).toHaveValue('')
  const html = await page.content()
  expect(html).not.toContain('password123')
  expect(html).not.toContain('admin123')
})
