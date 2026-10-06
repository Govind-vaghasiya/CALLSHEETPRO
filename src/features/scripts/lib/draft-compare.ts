/**
 * Draft comparison: lines two screenplay drafts up scene by scene and diffs them word by word.
 *
 * Each draft's scenes are rebuilt from its stored pages (script_pages), so any two drafts can be
 * compared at any time — the project's scenes only hold the text that was applied last.
 *
 * - Page furniture that changes whenever a script is re-paginated (page numbers, running headers,
 *   (MORE)/(CONT'D), CONTINUED lines, revision asterisks) is removed before comparing.
 * - Scenes are paired by number first, then leftovers by text similarity (renumbered scenes).
 *   The user can break or make pairs; those overrides are passed back in so the server applies
 *   exactly what the user saw.
 *
 * Client and server safe.
 */
import { diffArrays } from 'diff'
import { extractCharacterCues } from '@/features/characters/lib/character-cues'
import { parseSlugline } from './slugline'
import type { ParsedPage, ParsedScene } from './parser'

/** One scene of a draft, ready to compare and display. */
export interface DraftScene {
  number: string
  /** Position in the draft (0-based) */
  index: number
  heading: string
  locationName: string
  intExt: ParsedScene['intExt']
  timeOfDay: ParsedScene['timeOfDay']
  timeLabel: string | null
  pageStart: number
  pageEnd: number
  eighths: number
  /** Scene text without the slugline and page furniture, line breaks kept */
  body: string
  /** Speaking characters */
  cues: string[]
}

export interface Draft {
  id: string
  scenes: DraftScene[]
  /** Running header/footer lines (digits masked) found on this draft's pages */
  furniture: string[]
}

export type RowKind = 'UNCHANGED' | 'CHANGED' | 'NEW' | 'OMITTED'
export type PairedBy = 'NUMBER' | 'SIMILARITY' | 'USER'

/** A diff segment: 0 = same, -1 = only in the old draft, 1 = only in the new draft */
export type DiffPart = [op: -1 | 0 | 1, text: string]

export interface CompareRow {
  /** Stable id: "<old number>><new number>" */
  key: string
  kind: RowKind
  left: DraftScene | null
  right: DraftScene | null
  pairedBy: PairedBy | null
  renumbered: boolean
  /** Same number but the text barely overlaps — maybe not the same scene */
  doubtfulPair: boolean
  headingChanged: boolean
  /** Old-side and new-side segments of the scene text */
  leftParts: DiffPart[]
  rightParts: DiffPart[]
  headingLeftParts: DiffPart[]
  headingRightParts: DiffPart[]
  wordsAdded: number
  wordsRemoved: number
  charactersAdded: string[]
  charactersRemoved: string[]
  eighthsDelta: number
}

export interface PairOverrides {
  /** Row keys of automatic pairs the user split ("12>12A") */
  unpair: string[]
  /** Pairs the user made: [old number, new number] */
  pair: Array<[string, string]>
}

export const NO_OVERRIDES: PairOverrides = { unpair: [], pair: [] }

const normNumber = (n: string) => n.trim().toUpperCase().replace(/^#/, '')
export const rowKey = (left: string | null | undefined, right: string | null | undefined) =>
  `${left ? normNumber(left) : ''}>${right ? normNumber(right) : ''}`

// ---------------------------------------------------------------------------------------------
// Cleaning scene text
// ---------------------------------------------------------------------------------------------

const maskDigits = (line: string) => line.replace(/\s+/g, ' ').trim().replace(/\d+/g, '#').toUpperCase()

/**
 * Lines repeated at the top or bottom of many pages (draft name, date, "Page 12") are running
 * headers. Only the first and last two lines of a page are considered, so a character name that
 * appears on most pages is never mistaken for one.
 */
export function findPageFurniture(pages: ParsedPage[]): string[] {
  if (pages.length < 5) return []
  const counts = new Map<string, number>()
  for (const p of pages) {
    const lines = p.rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const edge = new Set([...lines.slice(0, 2), ...lines.slice(-2)].map(maskDigits))
    for (const l of edge) counts.set(l, (counts.get(l) || 0) + 1)
  }
  return Array.from(counts.entries())
    .filter(([line, n]) => n >= pages.length * 0.4 && !parseSlugline(line))
    .map(([line]) => line)
}

const PAGE_NUMBER = /^(page\s*)?\d{1,3}[A-Z]?\.?$/i
const CONTINUED = /^(\d+[A-Z]?\s+)?\(?\s*CONT(INUED|'D|’D|\.)?\s*\)?:?(\s*\(\d+\))?(\s+\d+[A-Z]?)?$/i
const MORE = /^\(\s*MORE\s*\)$/i
const CONTD = /\s*\((CONT'D|CONT’D|CONTD|CONT\.?|CONTINUING)\)/gi
const HAS_CONTD = /\((CONT'D|CONT’D|CONTD|CONT\.?|CONTINUING)\)/i

/** Scene text without the slugline and without page furniture. Line breaks are kept. */
export function cleanSceneBody(description: string, furniture: Iterable<string> = []): string {
  const skip = new Set(furniture)
  const lines = (description || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((raw) => raw.replace(/\s+\*+\s*$/, '').replace(/\s+/g, ' ').trim())
  // The first line is the slugline itself (compared separately)
  if (lines.length && parseSlugline(lines[0])) lines.shift()

  // A page break: page number, running header, CONTINUED, or (MORE) — at the end of a line too
  const isBreak = (line: string) =>
    PAGE_NUMBER.test(line) || CONTINUED.test(line) || MORE.test(line) || /\(\s*MORE\s*\)$/i.test(line) || skip.has(maskDigits(line))
  const nearBreak = (i: number) => {
    for (const step of [-1, 1]) {
      let j = i + step
      while (lines[j] === '') j += step
      if (lines[j] !== undefined && isBreak(lines[j])) return true
    }
    return false
  }

  const out: string[] = []
  lines.forEach((line, i) => {
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      return
    }
    if (PAGE_NUMBER.test(line) || CONTINUED.test(line) || MORE.test(line) || skip.has(maskDigits(line))) return
    // "SID (CONT'D)" printed again because a speech runs over a page break
    if (HAS_CONTD.test(line) && line === line.toUpperCase() && nearBreak(i)) return
    const cleaned = line.replace(/\s*\(\s*MORE\s*\)$/i, '').replace(CONTD, '').trim()
    if (cleaned) out.push(cleaned)
  })
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

/** Whitespace-insensitive form, for "is this the same text?" checks. */
export const comparableText = (text: string) => text.replace(/\s+/g, ' ').trim()

export function buildDraft(id: string, pages: ParsedPage[], parsed: ParsedScene[]): Draft {
  const furniture = findPageFurniture(pages)
  const seen = new Set<string>()
  const scenes: DraftScene[] = []
  for (const p of parsed) {
    const number = normNumber(p.sceneNumber)
    // scene_number is unique per project; a repeated number keeps its first scene (as scene sync does)
    if (seen.has(number)) continue
    seen.add(number)
    scenes.push({
      number,
      index: scenes.length,
      heading: p.heading,
      locationName: p.locationName,
      intExt: p.intExt,
      timeOfDay: p.timeOfDay,
      timeLabel: p.timeLabel,
      pageStart: p.pageStart,
      pageEnd: p.pageEnd,
      eighths: p.pageEighths,
      body: cleanSceneBody(p.description, furniture),
      cues: extractCharacterCues(p.description),
    })
  }
  return { id, scenes, furniture }
}

// ---------------------------------------------------------------------------------------------
// Matching and diffing
// ---------------------------------------------------------------------------------------------

const words = (text: string) => text.toLowerCase().match(/[a-z0-9']+/g) || []

/** Share of words two scenes have in common (0–1). */
function similarity(a: DraftScene, b: DraftScene): number {
  const wa = new Set(words(`${a.heading} ${a.body}`))
  const wb = new Set(words(`${b.heading} ${b.body}`))
  if (!wa.size || !wb.size) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.max(wa.size, wb.size)
}

/** Word-level diff that keeps each side's own spacing and line breaks. */
export function diffText(oldText: string, newText: string) {
  const tokenize = (t: string) => t.match(/\S+\s*|\s+/g) || []
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const changes = diffArrays(
    a.map((t) => t.trim()),
    b.map((t) => t.trim())
  )
  const left: DiffPart[] = []
  const right: DiffPart[] = []
  const push = (side: DiffPart[], op: DiffPart[0], text: string) => {
    if (!text) return
    const last = side[side.length - 1]
    if (last && last[0] === op) last[1] += text
    else side.push([op, text])
  }
  let ia = 0
  let ib = 0
  let added = 0
  let removed = 0
  for (const c of changes) {
    const n = c.count ?? c.value.length
    const countWords = (tokens: string[]) => tokens.filter((t) => t.trim()).length
    if (c.added) {
      const tokens = b.slice(ib, ib + n)
      push(right, 1, tokens.join(''))
      added += countWords(tokens)
      ib += n
    } else if (c.removed) {
      const tokens = a.slice(ia, ia + n)
      push(left, -1, tokens.join(''))
      removed += countWords(tokens)
      ia += n
    } else {
      push(left, 0, a.slice(ia, ia + n).join(''))
      push(right, 0, b.slice(ib, ib + n).join(''))
      ia += n
      ib += n
    }
  }
  return { left, right, added, removed }
}

function makeRow(left: DraftScene | null, right: DraftScene | null, pairedBy: PairedBy | null, score: number): CompareRow {
  const base: CompareRow = {
    key: rowKey(left?.number, right?.number),
    kind: !left ? 'NEW' : !right ? 'OMITTED' : 'UNCHANGED',
    left,
    right,
    pairedBy,
    renumbered: !!left && !!right && left.number !== right.number,
    doubtfulPair: false,
    headingChanged: false,
    leftParts: left ? [[0, left.body]] : [],
    rightParts: right ? [[0, right.body]] : [],
    headingLeftParts: left ? [[0, left.heading]] : [],
    headingRightParts: right ? [[0, right.heading]] : [],
    wordsAdded: 0,
    wordsRemoved: 0,
    charactersAdded: right && !left ? right.cues : [],
    charactersRemoved: left && !right ? left.cues : [],
    eighthsDelta: (right?.eighths ?? 0) - (left?.eighths ?? 0),
  }
  if (!left || !right) return base

  const headingChanged = comparableText(left.heading).toUpperCase() !== comparableText(right.heading).toUpperCase()
  const bodyChanged = comparableText(left.body) !== comparableText(right.body)
  if (headingChanged) {
    const h = diffText(left.heading, right.heading)
    base.headingLeftParts = h.left
    base.headingRightParts = h.right
  }
  if (bodyChanged) {
    const d = diffText(left.body, right.body)
    base.leftParts = d.left
    base.rightParts = d.right
    base.wordsAdded = d.added
    base.wordsRemoved = d.removed
  }
  const leftCues = new Set(left.cues)
  const rightCues = new Set(right.cues)
  return {
    ...base,
    kind: headingChanged || bodyChanged ? 'CHANGED' : 'UNCHANGED',
    headingChanged,
    doubtfulPair: pairedBy === 'NUMBER' && score < 0.25 && headingChanged,
    charactersAdded: right.cues.filter((c) => !leftCues.has(c)),
    charactersRemoved: left.cues.filter((c) => !rightCues.has(c)),
  }
}

/**
 * Line two drafts up into rows in the new draft's order; scenes only in the old draft are placed
 * after the scene that came before them there.
 */
export function compareDrafts(oldDraft: Draft, newDraft: Draft, overrides: PairOverrides = NO_OVERRIDES): CompareRow[] {
  const L = oldDraft.scenes
  const R = newDraft.scenes
  const leftBy = new Map(L.map((s) => [s.number, s]))
  const rightBy = new Map(R.map((s) => [s.number, s]))
  const unpair = new Set(overrides.unpair)
  const pairOfLeft = new Map<string, { right: DraftScene; by: PairedBy; score: number }>()
  const pairedRight = new Set<string>()
  const link = (l: DraftScene, r: DraftScene, by: PairedBy, score: number) => {
    pairOfLeft.set(l.number, { right: r, by, score })
    pairedRight.add(r.number)
  }

  // 1. The user's own pairs
  for (const [ln, rn] of overrides.pair) {
    const l = leftBy.get(normNumber(ln))
    const r = rightBy.get(normNumber(rn))
    if (l && r && !pairOfLeft.has(l.number) && !pairedRight.has(r.number)) link(l, r, 'USER', similarity(l, r))
  }
  const sameHeading = (l: DraftScene, r: DraftScene) =>
    comparableText(l.heading).toUpperCase() === comparableText(r.heading).toUpperCase()
  const free = (l: DraftScene, r: DraftScene) =>
    !pairOfLeft.has(l.number) && !pairedRight.has(r.number) && !unpair.has(rowKey(l.number, r.number))

  // 2. Same number and the text agrees. Numbers alone are not trusted: scripts without printed
  //    scene numbers are numbered in order, so one inserted scene shifts every number after it.
  for (const l of L) {
    const r = rightBy.get(l.number)
    if (!r || !free(l, r)) continue
    const score = similarity(l, r)
    if (sameHeading(l, r) || score >= 0.5) link(l, r, 'NUMBER', score)
  }
  // 3. Moved or renumbered: leftovers whose text mostly matches (short scenes need the same heading
  //    too, so two one-line scenes are not paired by accident). Nearby scenes win ties.
  const candidates: Array<{ l: DraftScene; r: DraftScene; score: number }> = []
  for (const l of L) {
    if (pairOfLeft.has(l.number)) continue
    for (const r of R) {
      if (!free(l, r)) continue
      const score = similarity(l, r)
      const short = Math.min(words(l.body).length, words(r.body).length) < 12
      if (score >= 0.5 && (!short || sameHeading(l, r))) candidates.push({ l, r, score: score - Math.abs(l.index - r.index) * 1e-4 })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  for (const c of candidates) {
    if (!free(c.l, c.r)) continue
    link(c.l, c.r, c.l.number === c.r.number ? 'NUMBER' : 'SIMILARITY', c.score)
  }
  // 4. Whatever is left with the same number is the same scene, rewritten
  for (const l of L) {
    const r = rightBy.get(l.number)
    if (r && free(l, r)) link(l, r, 'NUMBER', similarity(l, r))
  }

  // 5. Rows in the new draft's order, old-only scenes slotted in after their predecessor
  const leftOfRight = new Map<string, { left: DraftScene; by: PairedBy; score: number }>()
  pairOfLeft.forEach((p, ln) => leftOfRight.set(p.right.number, { left: leftBy.get(ln)!, by: p.by, score: p.score }))
  const sorted: Array<{ row: CompareRow; sort: [number, number] }> = R.map((r, i) => {
    const p = leftOfRight.get(r.number)
    return { row: makeRow(p?.left ?? null, r, p?.by ?? null, p?.score ?? 0), sort: [i, 0] }
  })
  const rightIndexOfLeft = (l: DraftScene) => {
    const p = pairOfLeft.get(l.number)
    return p ? p.right.index : null
  }
  let lastAnchor = -1
  let offset = 0
  for (const l of L) {
    const anchor = rightIndexOfLeft(l)
    if (anchor !== null) {
      lastAnchor = anchor
      offset = 0
      continue
    }
    sorted.push({ row: makeRow(l, null, null, 0), sort: [lastAnchor, 1 + offset++] })
  }
  sorted.sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1])
  return sorted.map((s) => s.row)
}

export interface CompareSummary {
  changed: number
  added: number
  omitted: number
  renumbered: number
  unchanged: number
  eighthsDelta: number
}

export function summarize(rows: CompareRow[]): CompareSummary {
  const s: CompareSummary = { changed: 0, added: 0, omitted: 0, renumbered: 0, unchanged: 0, eighthsDelta: 0 }
  for (const r of rows) {
    if (r.kind === 'CHANGED') s.changed++
    else if (r.kind === 'NEW') s.added++
    else if (r.kind === 'OMITTED') s.omitted++
    else s.unchanged++
    if (r.renumbered) s.renumbered++
    s.eighthsDelta += r.eighthsDelta
  }
  return s
}

// ---------------------------------------------------------------------------------------------
// Where each row stands in the app
// ---------------------------------------------------------------------------------------------

/** The project's scene as the compare view needs it. */
export interface ProjectSceneState {
  id: string
  scene_number: string
  heading: string | null
  location_name: string | null
  description: string | null
  script_document_id: string | null
  synopsis: string | null
  /** CAST breakdown items in the scene */
  cast: string[]
  /** Shoot days the scene is scheduled on */
  days: Array<{ dayNumber: number | null; date: string; callSheet: 'DRAFT' | 'PUBLISHED' | 'REVISED' | 'ARCHIVED' | null }>
}

/**
 * - APPLIED: the app already has the new draft's version of this scene (or nothing to do)
 * - PENDING: the app still has an older version of this scene
 * - EDITED: the app's text matches neither draft (edited in the app) — applying replaces it
 * - TAKEN: the scene number is used by a different scene in the app that is not moving away
 */
export type AppState = 'APPLIED' | 'PENDING' | 'EDITED' | 'TAKEN'

export interface RowStatus {
  state: AppState
  /** The project scene this row changes (null: applying adds a new scene) */
  scene: ProjectSceneState | null
}

export interface StatusContext {
  byNumber: Map<string, ProjectSceneState>
  furniture: string[]
  /** The new draft: scenes whose text came from it are already applied */
  newDraftId: string
  /** Scene numbers in the app that other rows move away from (renumbered or omitted) */
  leaving: Set<string>
}

export function statusContext(rows: CompareRow[], scenes: ProjectSceneState[], oldDraft: Draft, newDraft: Draft): StatusContext {
  const leaving = new Set<string>()
  for (const r of rows) if (r.left && (!r.right || r.renumbered)) leaving.add(r.left.number)
  return {
    byNumber: projectScenesByNumber(scenes),
    furniture: [...oldDraft.furniture, ...newDraft.furniture],
    newDraftId: newDraft.id,
    leaving,
  }
}

export function rowStatus(row: CompareRow, ctx: StatusContext): RowStatus {
  const sameAs = (scene: ProjectSceneState, draftScene: DraftScene) =>
    comparableText(cleanSceneBody(scene.description || '', ctx.furniture)) === comparableText(draftScene.body) &&
    comparableText(cleanHeading(scene.heading)).toUpperCase() === comparableText(draftScene.heading).toUpperCase()
  const fromNewDraft = (scene: ProjectSceneState | undefined) => !!scene && scene.script_document_id === ctx.newDraftId
  /** No scene to update: a new one is added — unless its number is held by a scene that stays */
  const addAt = (number: string): RowStatus => {
    const occupant = ctx.byNumber.get(number)
    return { state: occupant && !ctx.leaving.has(number) ? 'TAKEN' : 'PENDING', scene: null }
  }

  if (row.left && !row.right) {
    const scene = ctx.byNumber.get(row.left.number)
    // Still in the app unless that number now belongs to a scene from the new draft
    return scene && !fromNewDraft(scene) ? { state: 'PENDING', scene } : { state: 'APPLIED', scene: null }
  }
  const right = row.right!
  const atRight = ctx.byNumber.get(right.number)
  // Already taken from the new draft (later edits in the app are the user's own)
  if (fromNewDraft(atRight)) return { state: 'APPLIED', scene: atRight! }
  if (!row.left) return addAt(right.number)

  const scene = ctx.byNumber.get(row.left.number)
  if (!scene || fromNewDraft(scene)) return addAt(right.number)
  if (row.renumbered && atRight && atRight.id !== scene.id && !ctx.leaving.has(right.number)) return { state: 'TAKEN', scene }
  return { state: sameAs(scene, row.left) || sameAs(scene, right) ? 'PENDING' : 'EDITED', scene }
}

function cleanHeading(heading: string | null): string {
  if (!heading) return ''
  return parseSlugline(heading)?.heading ?? heading.trim()
}

export const projectScenesByNumber = (scenes: ProjectSceneState[]) =>
  new Map(scenes.map((s) => [normNumber(s.scene_number), s]))

/** What the user chose for one row. */
export interface RowDecision {
  key: string
  /** CAST items to add to the scene's breakdown */
  addCast: string[]
  /** CAST items to remove from the scene's breakdown */
  removeCast: string[]
  /** OMITTED rows: delete the scene (with its breakdown and schedule placement) */
  deleteScene?: boolean
}
