/**
 * Industry-format screenplay printing (US Letter, Courier 12pt):
 *  left margin 1.5", right 1", top/bottom 1"; character cue at 3.7" from the paper edge,
 *  dialogue 2.5"–6", parenthetical 3.1"; scene numbers in both margins; page number top-right.
 * Uses the same line classification as the on-screen reader.
 */
import { classifyScreenplayLines, type FormattedScreenplayLine } from './screenplay-format'
import { escapeHtml, printHtml } from '@/lib/print/print-document'

export interface PrintableScene {
  scene_number: string
  heading: string | null
  description: string | null
}

const CSS = `
  /* Page margins are kept small and the text is inset with padding instead, so scene numbers can sit
     in the "margin" without being clipped: text runs 1.5in from the left edge and 1in from the right. */
  @page { size: Letter portrait; margin: 1in 0.4in 0.75in 0.75in;
    @top-right { content: counter(page) "."; font: 12pt "Courier Prime", "Courier New", Courier, monospace; }
  }
  @page :first { @top-right { content: none; } }
  body { font: 12pt/1.0 "Courier Prime", "Courier New", Courier, monospace; color: #000; padding: 0 0.6in 0 0.75in; }
  p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .gap { height: 12pt; }
  .slug { position: relative; font-weight: bold; text-transform: uppercase; margin-top: 12pt; break-after: avoid; }
  .slug[data-num]::before { content: attr(data-num); position: absolute; left: -0.6in; }
  .slug[data-num]::after { content: attr(data-num); position: absolute; right: -0.5in; }
  .action { width: 6in; }
  .speech { break-inside: avoid-page; margin-top: 12pt; }
  .speech.long { break-inside: auto; }
  .character { margin-left: 2.2in; text-transform: uppercase; break-after: avoid; }
  .paren { margin-left: 1.6in; width: 2in; break-after: avoid; }
  .dialogue { margin-left: 1in; width: 3.5in; }
  .transition { text-align: right; text-transform: uppercase; margin-top: 12pt; break-before: avoid; }
  .scene-break { break-before: page; }
  .title-page { height: 9in; display: flex; flex-direction: column; justify-content: center; text-align: center; break-after: page; }
  .title-page h1 { font: bold 12pt "Courier Prime", "Courier New", Courier, monospace; text-transform: uppercase; text-decoration: underline; margin: 0 0 24pt; }
  .title-page .meta { position: absolute; bottom: 1in; left: 0; text-align: left; }
`

/** Turn classified lines into print HTML, grouping each speech so a cue never sits alone at a page end. */
function linesToHtml(lines: FormattedScreenplayLine[], sceneNumber?: string): string {
  const out: string[] = []
  let speech: string[] = []
  let speechLines = 0
  let lastWasGap = true

  const flushSpeech = () => {
    if (!speech.length) return
    out.push(`<div class="speech${speechLines > 12 ? ' long' : ''}">${speech.join('')}</div>`)
    speech = []
    speechLines = 0
    lastWasGap = false
  }

  for (const line of lines) {
    const text = escapeHtml(line.text.trim())
    // Page numbers and (CONTINUED) markers copied from the source PDF are not script text
    if (/^\d{1,3}\.$/.test(text) || /^\(?CONTINUED\)?:?$/i.test(text) || /^\(MORE\)$/i.test(text)) continue
    switch (line.type) {
      case 'PRINT_FOOTER':
        continue
      case 'EMPTY':
        flushSpeech()
        if (!lastWasGap) out.push('<div class="gap"></div>')
        lastWasGap = true
        continue
      case 'SLUGLINE': {
        flushSpeech()
        const num = line.matchedSceneNumber || sceneNumber
        out.push(`<p class="slug"${num ? ` data-num="${escapeHtml(num)}"` : ''}>${text}</p>`)
        lastWasGap = false
        continue
      }
      case 'CHARACTER':
        flushSpeech()
        speech.push(`<p class="character">${text}</p>`)
        speechLines++
        continue
      case 'PARENTHETICAL':
        speech.push(`<p class="paren">${text}</p>`)
        speechLines++
        continue
      case 'DIALOGUE':
        if (!speech.length) speech.push('') // stray dialogue line: still indent it
        speech.push(`<p class="dialogue">${text}</p>`)
        speechLines += Math.ceil(text.length / 35)
        continue
      case 'TRANSITION':
        flushSpeech()
        out.push(`<p class="transition">${text}</p>`)
        lastWasGap = false
        continue
      default:
        flushSpeech()
        out.push(`<p class="action">${text}</p>`)
        lastWasGap = false
    }
  }
  flushSpeech()
  return out.join('\n')
}

function sceneText(scene: PrintableScene) {
  const heading = scene.heading || ''
  const body = scene.description?.trim() || ''
  if (!body) return heading
  return body.toUpperCase().startsWith(heading.toUpperCase()) ? body : `${heading}\n\n${body}`
}

/** The printable document for scenes: { title, body, css } (also used to test output). */
export function scenesDocument(opts: { title: string; draftLabel: string; scenes: PrintableScene[] }) {
  const body = opts.scenes
    .map((s, i) => {
      const lines = classifyScreenplayLines(sceneText(s), [{ sceneNumber: s.scene_number, heading: s.heading || '' }])
      return `<section${i > 0 ? ' class="scene-break"' : ''}>${linesToHtml(lines, s.scene_number)}</section>`
    })
    .join('\n')
  const label = opts.scenes.length === 1 ? `Sc ${opts.scenes[0].scene_number}` : `${opts.scenes.length} scenes`
  return { title: `${opts.title} — ${label} (${opts.draftLabel})`, body, css: CSS }
}

/** Print one or more scenes (each from its own stored text). */
export function printScenes(opts: { title: string; draftLabel: string; scenes: PrintableScene[] }) {
  const d = scenesDocument(opts)
  return printHtml(d.body, { title: d.title, css: d.css })
}

/**
 * The printable document for the full script: one printed page per stored script page, carrying
 * the script's own page number (the script's own title page is already page 1).
 */
export function fullScriptDocument(opts: {
  title: string
  draftLabel: string
  date?: string | null
  pages: Array<{ page_number: number; raw_text: string | null }>
  scenes: Array<{ scene_number: string; heading: string | null }>
}) {
  const mapped = opts.scenes.map((s) => ({ sceneNumber: s.scene_number, heading: s.heading || '' }))
  const body = [...opts.pages]
    .filter((p) => (p.raw_text || '').trim().length > 0)
    .sort((a, b) => a.page_number - b.page_number)
    .map(
      (p, i) =>
        `<section class="script-page"${i > 0 ? ' style="break-before: page"' : ''}>${
          p.page_number > 1 ? `<p class="page-no">${p.page_number}.</p>` : ''
        }${linesToHtml(classifyScreenplayLines(p.raw_text || '', mapped))}</section>`
    )
    .join('\n')
  const css = `${CSS}
  @page { @top-right { content: none; } }
  .page-no { text-align: right; margin: 0 -0.5in 12pt 0; }`
  return { title: `${opts.title} (${opts.draftLabel})`, body, css }
}

/** Print the full script from its stored pages. */
export function printFullScript(opts: Parameters<typeof fullScriptDocument>[0]) {
  const d = fullScriptDocument(opts)
  return printHtml(d.body, { title: d.title, css: d.css })
}
