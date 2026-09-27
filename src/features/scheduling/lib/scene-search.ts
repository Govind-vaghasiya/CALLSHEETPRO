/**
 * Forgiving, search-everything scene lookup used wherever scenes are found (stripboard, pickers).
 *
 * Searches: scene number, heading, location, INT/EXT, time of day, the full scene text
 * (action + dialogue), breakdown items (cast, props, vehicles…), actor names, tags, notes,
 * and — for scheduled scenes — the shoot day ("day 3", "20/09", "sep").
 *
 * - Filler words people naturally type are ignored: "scene 8", "sc. 8", "#8" → scene 8.
 * - Every word must match somewhere; results are ranked (exact scene number first, then
 *   heading/breakdown hits, then text hits), and each result says where it matched.
 */

export interface SearchableScene {
  scene_number: string
  heading: string | null
  location_name: string | null
  int_ext: string | null
  time_of_day: string | null
  description?: string | null
}

/** Extra per-scene data from the breakdown (see scene-search-index.ts). */
export interface SceneSearchExtras {
  elements: string[] // breakdown item names (characters, props, vehicles…)
  people: string[] // actor names linked in Cast & Crew
  tags: string[]
  notes: string[]
}

export interface SceneMatch {
  score: number
  /** Where the best hit came from, e.g. "Dialogue & action", "Cast", "Day 3" */
  matchedIn: string | null
  /** Short excerpt around a text hit */
  snippet: string | null
}

const FILLER = new Set(['scene', 'scenes', 'sc', 'scn'])

const normalize = (s: string | null | undefined) =>
  (s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Split a query into meaningful tokens ("Scene #8A" → ["8a"]). */
export function tokenizeSceneQuery(query: string): string[] {
  return normalize(
    query
      .replace(/\bsc(?:ene)?\.?(?=\d)/gi, ' ')
      // "day 3" / "day3" / "d3" means shoot day 3, not "a DAY scene" + "scene 3"
      .replace(/\b(?:day|d)\s*#?\s*(\d+)\b/gi, ' shootday$1 ')
      // dates: 2026-09-20, 20/09, 20-09-2026, 20.9 → one exact date token
      .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (_m, _y, mo, d) => ` shootdate${d.padStart(2, '0')}${mo.padStart(2, '0')} `)
      .replace(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-]\d{2,4})?\b/g, (_m, d, mo) => ` shootdate${d.padStart(2, '0')}${mo.padStart(2, '0')} `)
  )
    .split(' ')
    .filter((t) => t && !FILLER.has(t))
}

interface Field {
  label: string
  text: string
  words: string[]
  weight: number
}

function field(label: string, value: string | null | undefined, weight: number): Field | null {
  const text = normalize(value)
  return text ? { label, text, words: text.split(' '), weight } : null
}

/** ~70 characters of original text around the first occurrence of `token`. */
function makeSnippet(original: string, token: string): string | null {
  const flat = original.replace(/\s+/g, ' ').trim()
  const lower = flat.toLowerCase().replace(/[’']/g, '')
  const at = lower.indexOf(token)
  if (at < 0) return null
  const start = Math.max(0, at - 30)
  const end = Math.min(flat.length, at + token.length + 40)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

export function matchScene(
  scene: SearchableScene,
  query: string,
  extras?: SceneSearchExtras,
  dayText?: string
): SceneMatch {
  const tokens = tokenizeSceneQuery(query)
  if (tokens.length === 0) return { score: 1, matchedIn: null, snippet: null }

  const number = normalize(scene.scene_number).replace(/\s/g, '')
  const fields = [
    field('Heading', [scene.heading, scene.location_name].filter(Boolean).join(' '), 20),
    field('Setting', [scene.int_ext?.replace('_', ' '), scene.time_of_day].filter(Boolean).join(' '), 12),
    field('Breakdown', extras?.elements.join(' '), 16),
    field('Cast & Crew', extras?.people.join(' '), 16),
    field('Shoot day', dayText, 14),
    field('Tags', extras?.tags.join(' '), 10),
    field('Notes', extras?.notes.join(' '), 8),
    field('Dialogue & action', scene.description, 6),
  ].filter((f): f is Field => f !== null)

  let score = 0
  let best: { label: string; points: number; token: string } | null = null

  for (const token of tokens) {
    let points = 0
    let label: string | null = null

    if (number === token) {
      points = 100
      label = 'Scene number'
    } else if (/^\d/.test(token) && number.startsWith(token) && /^[a-z]*$/.test(number.slice(token.length))) {
      points = 60 // 8 → 8A
      label = 'Scene number'
    } else {
      for (const f of fields) {
        const p = f.words.includes(token)
          ? f.weight
          : f.words.some((w) => w.startsWith(token))
            ? f.weight / 2
            : token.length >= 3 && f.text.includes(token)
              ? f.weight / 4
              : 0
        if (p > points) {
          points = p
          label = f.label
        }
      }
      if (points === 0 && /^\d/.test(token) && number.includes(token)) {
        points = 2 // 8 → 18, 28 (ranked last)
        label = 'Scene number'
      }
    }

    if (points === 0) return { score: 0, matchedIn: null, snippet: null }
    score += points
    // Remember the most "surprising" hit to explain the match (anything but the obvious heading/number)
    if (label && (!best || (label !== 'Scene number' && label !== 'Heading' && best.points >= points) || !best.label))
      best = { label, points, token }
  }

  const explain = best && best.label !== 'Scene number' && best.label !== 'Heading' ? best : null
  let snippet: string | null = null
  if (explain?.label === 'Dialogue & action' && scene.description) snippet = makeSnippet(scene.description, explain.token)
  else if (explain?.label === 'Notes' && extras) snippet = makeSnippet(extras.notes.join(' · '), explain.token)
  else if (explain?.label === 'Breakdown' && extras) snippet = makeSnippet(extras.elements.join(', '), explain.token)
  else if (explain?.label === 'Cast & Crew' && extras) snippet = makeSnippet(extras.people.join(', '), explain.token)

  return { score, matchedIn: explain?.label ?? null, snippet }
}

/** Kept for simple callers: 0 = no match. */
export function sceneMatchScore(scene: SearchableScene, query: string, extras?: SceneSearchExtras) {
  return matchScene(scene, query, extras).score
}

/** Filter + rank a list by the query (stable for equal scores), keeping match details. */
export function searchScenesDetailed<T>(
  items: T[],
  query: string,
  getScene: (item: T) => SearchableScene,
  getExtras?: (item: T) => SceneSearchExtras | undefined,
  getDayText?: (item: T) => string | undefined
): Array<{ item: T; match: SceneMatch }> {
  if (tokenizeSceneQuery(query).length === 0) {
    return items.map((item) => ({ item, match: { score: 1, matchedIn: null, snippet: null } }))
  }
  return items
    .map((item, index) => ({
      item,
      index,
      match: matchScene(getScene(item), query, getExtras?.(item), getDayText?.(item)),
    }))
    .filter((r) => r.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score || a.index - b.index)
    .map(({ item, match }) => ({ item, match }))
}

export function searchScenes<T>(
  items: T[],
  query: string,
  getScene: (item: T) => SearchableScene,
  getExtras?: (item: T) => SceneSearchExtras | undefined
): T[] {
  return searchScenesDetailed(items, query, getScene, getExtras).map((r) => r.item)
}

/** Text describing a shoot day for search (day number token, date formats, month, weekday). */
export function daySearchText(day: { day_number: number | null; shoot_date: string }) {
  const d = new Date(`${day.shoot_date}T00:00:00`)
  const [y, m, dd] = day.shoot_date.split('-')
  return [
    `shootday${day.day_number ?? ''}`,
    `shootdate${dd}${m}`,
    y,
    d.toLocaleDateString('en', { month: 'short' }),
    d.toLocaleDateString('en', { month: 'long' }),
    d.toLocaleDateString('en', { weekday: 'short' }),
    d.toLocaleDateString('en', { weekday: 'long' }),
  ].join(' ')
}

/** INT/EXT filter where INT/EXT scenes count as both. */
export function matchesIntExt(intExt: string | null, filter: 'ALL' | 'INT' | 'EXT') {
  if (filter === 'ALL') return true
  if (intExt === 'INT_EXT') return true
  return (intExt || 'INT') === filter
}
