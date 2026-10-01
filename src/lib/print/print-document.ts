/**
 * Print a clean document — never the app screen.
 *
 * The content is written into a hidden iframe with its own page setup (size, margins, page
 * numbers) and printed from there, so headers, sidebars, buttons, dark mode, and scroll
 * containers can't leak into the printout. "Save as PDF" in the print dialog gives the PDF.
 */

export interface PrintOptions {
  /** Document title — browsers use it as the default PDF file name */
  title: string
  size?: 'Letter' | 'A4'
  orientation?: 'portrait' | 'landscape'
  /** CSS margin for @page, e.g. "0.5in" or "1in 1in 0.75in 1.5in" */
  margin?: string
  /** Extra CSS for this document */
  css?: string
  /** Include the app's stylesheets (needed when printing app markup that uses Tailwind classes) */
  appStyles?: boolean
  /** Shrink content that is wider than the page (wide tables) */
  fitToWidth?: boolean
  /** Page number in the bottom-right corner */
  pageNumbers?: boolean
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export { escapeHtml }

function appStylesHtml() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n')
}

const BASE_CSS = `
  html, body { background: #fff !important; color: #000; margin: 0; padding: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  [data-print-hide], .no-print { display: none !important; }
  img, svg, tr, thead { break-inside: avoid; }
  thead { display: table-header-group; }
  table { border-collapse: collapse; }
  /* Screen-only scroll areas must show everything when printed */
  .overflow-auto, .overflow-x-auto, .overflow-y-auto, [class*="max-h-"] { overflow: visible !important; max-height: none !important; }
`

/** Print an HTML string as its own document. */
export async function printHtml(bodyHtml: string, opts: PrintOptions): Promise<void> {
  const size = `${opts.size || 'Letter'} ${opts.orientation || 'portrait'}`
  const pageNumberCss = opts.pageNumbers
    ? `@bottom-right { content: counter(page) " / " counter(pages); font: 9pt -apple-system, "Segoe UI", sans-serif; color: #555; }`
    : ''

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument!
  doc.open()
  doc.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<base href="${location.origin}/" />
<title>${escapeHtml(opts.title)}</title>
${opts.appStyles ? appStylesHtml() : ''}
<style>
  @page { size: ${size}; margin: ${opts.margin || '0.5in'}; ${pageNumberCss} }
  ${BASE_CSS}
  ${opts.css || ''}
</style>
</head>
<body>${bodyHtml}</body>
</html>`)
  doc.close()

  // Wait for stylesheets and fonts so the first printed page isn't unstyled
  const win = iframe.contentWindow!
  await Promise.race([
    Promise.all(
      Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(
        (l) =>
          new Promise<void>((resolve) => {
            const link = l as HTMLLinkElement
            if (link.sheet) return resolve()
            link.addEventListener('load', () => resolve(), { once: true })
            link.addEventListener('error', () => resolve(), { once: true })
          })
      )
    ),
    new Promise((r) => setTimeout(r, 3000)),
  ])
  try {
    await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 2000))])
  } catch {}

  if (opts.fitToWidth) {
    // Printable width in CSS px (96/in) minus margins, approximated from the page size
    const inches = opts.orientation === 'landscape' ? (opts.size === 'A4' ? 11.69 : 11) : opts.size === 'A4' ? 8.27 : 8.5
    const available = (inches - 1) * 96
    const needed = doc.body.scrollWidth
    if (needed > available) (doc.body.style as CSSStyleDeclaration & { zoom: string }).zoom = String(available / needed)
  }

  // Some browsers name the PDF after the top window's title
  const previousTitle = document.title
  document.title = opts.title

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      document.title = previousTitle
      setTimeout(() => iframe.remove(), 500)
      resolve()
    }
    win.addEventListener('afterprint', cleanup, { once: true })
    win.focus()
    win.print()
    // Safari/iOS don't always fire afterprint
    setTimeout(cleanup, 60_000)
  })
}

/** Print one element of the page (cloned, with the app's styles) as its own document. */
export async function printElement(
  element: HTMLElement,
  opts: PrintOptions & { headerHtml?: string }
): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-print-hide], .no-print').forEach((el) => el.remove())
  // Form controls print their current value, not their default
  const sourceInputs = element.querySelectorAll('input, select, textarea')
  clone.querySelectorAll('input, select, textarea').forEach((el, i) => {
    const src = sourceInputs[i] as HTMLInputElement
    if (el instanceof HTMLSelectElement) {
      const text = (src as unknown as HTMLSelectElement).selectedOptions?.[0]?.text ?? ''
      el.replaceWith(Object.assign(document.createElement('span'), { textContent: text }))
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.setAttribute('value', src?.value ?? '')
    }
  })
  return printHtml(`${opts.headerHtml || ''}${clone.outerHTML}`, { appStyles: true, ...opts })
}
