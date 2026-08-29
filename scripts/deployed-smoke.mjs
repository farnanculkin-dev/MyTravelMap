import { chromium } from 'playwright'

const baseUrl = process.env.FAMILY_ATLAS_BASE_URL
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!baseUrl) throw new Error('FAMILY_ATLAS_BASE_URL is required')
if (!bypassSecret) throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  extraHTTPHeaders: {
    'x-vercel-protection-bypass': bypassSecret,
    'x-vercel-set-bypass-cookie': 'true',
  },
})

try {
  const page = await context.newPage()
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  if (!response || !response.ok()) {
    throw new Error(`Develop deployment returned HTTP ${response?.status() ?? 'no response'}`)
  }

  const body = await page.locator('body').innerText()
  if (!body.includes('Family Atlas') && !body.includes('Our Family Travel Map')) {
    throw new Error('Family Atlas UI did not render expected content')
  }

  const signInInput = page.locator('input[type="email"]')
  const atlasHeading = page.getByRole('heading', { name: /Our Family Travel Map/i })

  if ((await signInInput.count()) === 0 && (await atlasHeading.count()) === 0) {
    throw new Error('Neither the sign-in screen nor authenticated Atlas home rendered')
  }

  console.log('Deployed Family Atlas smoke test passed.')
} finally {
  await browser.close()
}
