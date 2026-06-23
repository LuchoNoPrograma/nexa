import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function renderThermalHtmlToPdf(html: string) {
  const executablePath = process.env.CHROMIUM_PATH || await chromium.executablePath()
  const browser = await puppeteer.launch({
    args: [...new Set([...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'])],
    defaultViewport: { width: 320, height: 900, deviceScaleFactor: 1 },
    executablePath,
    headless: chromium.headless,
  })

  try {
    const page = await browser.newPage()

    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (request.resourceType() === 'document') {
        request.continue()
        return
      }

      request.abort()
    })

    await page.setContent(html, { waitUntil: 'load', timeout: 7000 })
    await page.emulateMediaType('print')

    const ticketHeightPx = await page.$eval('.ticket', element => Math.ceil((element as HTMLElement).scrollHeight))
    const ticketHeightMm = Math.max(120, Math.ceil(ticketHeightPx * 25.4 / 96) + 2)
    const pdf = await page.pdf({
      width: '80mm',
      height: `${ticketHeightMm}mm`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
