/**
 * One-liner report: every scene on one line — number, INT/EXT, time of day, location, the
 * one-liner, cast numbers, length in eighths and estimated shoot time — as a printable PDF
 * (via the print dialog's "Save as PDF") or a CSV for Excel / Google Sheets.
 */
import type { ScriptSceneItem } from '@/features/scripts/actions'
import { escapeHtml, printHtml } from '@/lib/print/print-document'
import type { OneLinerReportData } from '../actions'
import { cleanSceneHeading, formatEighths, sceneEighths, sceneTimeLabel } from './one-liners'

const INT_EXT_LABEL: Record<string, string> = { INT: 'INT', EXT: 'EXT', INT_EXT: 'INT/EXT' }

export interface OneLinerRow {
  sceneNumber: string
  intExt: string
  time: string
  location: string
  oneLiner: string
  cast: string[]
  eighths: number
  eighthsEstimated: boolean
  page: number | null
  estMinutes: number | null
}

export function buildOneLinerRows(scenes: ScriptSceneItem[], report: OneLinerReportData): OneLinerRow[] {
  return scenes.map((s) => {
    const { eighths, estimated } = sceneEighths(s)
    return {
      sceneNumber: s.scene_number,
      intExt: s.int_ext ? INT_EXT_LABEL[s.int_ext] || s.int_ext : '',
      time: sceneTimeLabel(s),
      location: s.location_name || cleanSceneHeading(s.heading),
      oneLiner: s.synopsis?.trim() || '',
      cast: report.castByScene[s.id] || [],
      eighths,
      eighthsEstimated: estimated,
      page: s.page_start,
      estMinutes: s.estimated_duration,
    }
  })
}

const fileSafe = (name: string) => name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Production'

function totalEighths(rows: OneLinerRow[]) {
  return rows.reduce((sum, r) => sum + r.eighths, 0)
}

/** Download the report as CSV (UTF-8 with BOM so Excel keeps apostrophes and accents). */
export function downloadOneLinerCsv(rows: OneLinerRow[], report: OneLinerReportData, projectName: string) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    ['Scene', 'INT/EXT', 'Time', 'Location', 'One-liner', 'Cast', 'Pages', 'Page', 'Est. Time (min)'].join(','),
    ...rows.map((r) =>
      [r.sceneNumber, r.intExt, r.time, r.location, r.oneLiner, r.cast.join(', '), formatEighths(r.eighths), r.page, r.estMinutes]
        .map(cell)
        .join(',')
    ),
    '',
    ['Total', '', '', '', `${rows.length} scenes`, '', formatEighths(totalEighths(rows))].map(cell).join(','),
  ]
  if (report.cast.length > 0) {
    lines.push('', 'Cast ID,Character')
    for (const c of report.cast) lines.push([cell(c.castNumber ?? '—'), cell(c.name)].join(','))
  }

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileSafe(projectName)}_One_Liners.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const REPORT_CSS = `
  body { font: 8.5pt -apple-system, "Helvetica Neue", Arial, sans-serif; color: #000; }
  .title { background: #000; color: #fff; font-weight: 700; font-size: 14pt; padding: 8px 10px; letter-spacing: .02em; }
  .meta { display: flex; justify-content: space-between; font-size: 8pt; color: #333; margin: 4px 2px 10px; }
  h2 { font-size: 10pt; text-decoration: underline; margin: 0 0 4px; }
  .cast { column-count: 3; column-gap: 24px; margin: 0 0 14px; padding: 0; list-style: none; }
  .cast li { break-inside: avoid; padding: 1px 0; }
  table { width: 100%; border: 1px solid #000; }
  td, th { border: 1px solid #000; padding: 4px 5px; vertical-align: top; text-align: left; }
  th { background: #eee; font-size: 7.5pt; text-transform: uppercase; }
  tr { break-inside: avoid; }
  .num { font-size: 9.5pt; white-space: nowrap; }
  .sub { color: #444; font-size: 7.5pt; white-space: nowrap; }
  .loc { color: #333; }
  /* The one-liner is the only bold text in a row */
  .line { margin-top: 2px; font-weight: 700; font-size: 9pt; }
  .empty { color: #999; font-style: italic; font-weight: 400; }
  .castids { font-size: 7.5pt; }
  .r { text-align: right; white-space: nowrap; }
  tfoot td { background: #f6f6f6; }
`

/** Open the print dialog with the one-liner report ("Save as PDF" gives the PDF). */
export async function printOneLinerReport(rows: OneLinerRow[], report: OneLinerReportData, projectName: string) {
  const esc = (s: string) => escapeHtml(s)
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const anyEstimated = rows.some((r) => r.eighthsEstimated)

  const castHtml = report.cast.length
    ? `<h2>CAST MEMBERS</h2><ol class="cast">${report.cast
        .map((c) => `<li>${c.castNumber != null ? `${c.castNumber}. ` : ''}${esc(c.name.toUpperCase())}</li>`)
        .join('')}</ol>`
    : ''

  const rowsHtml = rows
    .map(
      (r) => `<tr>
  <td><div class="num">${esc(r.sceneNumber)}</div>${r.page != null ? `<div class="sub">Pg ${r.page}</div>` : ''}</td>
  <td><div>${esc(r.intExt)}</div><div class="sub">${esc(r.time)}</div></td>
  <td><div class="loc">${esc(r.location)}</div><div class="line">${r.oneLiner ? esc(r.oneLiner) : '<span class="empty">No one-liner yet</span>'}</div></td>
  <td class="castids">${esc(r.cast.join(', '))}</td>
  <td class="r">${formatEighths(r.eighths)}${r.eighthsEstimated ? '*' : ''}</td>
  <td class="r">${r.estMinutes ? `${r.estMinutes} min` : ''}</td>
</tr>`
    )
    .join('\n')

  const html = `
<div class="title">ONE LINERS — ${esc(projectName.toUpperCase())}</div>
<div class="meta"><span>${rows.length} scenes · ${formatEighths(totalEighths(rows))} pages</span><span>${esc(today)}</span></div>
${castHtml}
<table>
  <colgroup><col style="width:9%"><col style="width:10%"><col><col style="width:16%"><col style="width:7%"><col style="width:8%"></colgroup>
  <thead><tr><th>Scene</th><th>I/E · Time</th><th>Location · One-liner</th><th>Cast</th><th class="r">Pages</th><th class="r">Est. Time</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr><td colspan="4">Total · ${rows.length} scenes</td><td class="r">${formatEighths(totalEighths(rows))}</td><td></td></tr></tfoot>
</table>
${anyEstimated ? '<p class="sub" style="margin-top:6px">* Page length estimated — re-upload the script to measure it exactly.</p>' : ''}`

  await printHtml(html, {
    title: `${projectName} — One Liners`,
    size: 'Letter',
    orientation: 'portrait',
    margin: '0.45in',
    css: REPORT_CSS,
    pageNumbers: true,
  })
}
