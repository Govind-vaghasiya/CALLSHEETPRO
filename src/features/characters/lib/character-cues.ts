/**
 * Finds speaking characters in screenplay text.
 *
 * A character cue is a short all-caps line immediately followed by dialogue (or a
 * parenthetical, then dialogue). Extensions are stripped so "LAKHAN (V.O.)" and
 * "LAKHAN (CONT'D)" both give "LAKHAN". Sluglines, transitions, and common all-caps
 * direction lines ("THE END", "CONTINUED", "MOMENTS LATER") are never treated as characters.
 */

const NOT_CHARACTERS = new Set([
  'THE END',
  'END',
  'CONTINUED',
  'MORE',
  'MOMENTS LATER',
  'LATER',
  'CONTINUOUS',
  'SAME TIME',
  'BACK TO SCENE',
  'FLASHBACK',
  'END FLASHBACK',
  'INTERCUT',
  'SUPER',
  'TITLE',
  'MONTAGE',
  'END MONTAGE',
  'SERIES OF SHOTS',
  'BLACK',
  'BLACKOUT',
  'SILENCE',
  'BEAT',
  'PAUSE',
  'OMITTED',
])

const EXTENSION = /\s*\((?:V\.?\s*O\.?|O\.?\s*S\.?|O\.?\s*C\.?|CONT'?D|CONT\.?|CONTINUED|FILTERED|PRE-?LAP|ON PHONE|INTO PHONE|SUBTITLED|[A-Z .'-]{1,20})\)\s*/gi

const isSlug = (l: string) => /^(INT|EXT|INT\.?\/EXT|I\/E|EST)[\s.]/.test(l)
const isTransition = (l: string) => /(TO:|OUT\.|IN:)$/.test(l) || /^(FADE|CUT|DISSOLVE|SMASH|MATCH|WIPE|IRIS)\b/.test(l)
const isAllCaps = (l: string) => l === l.toUpperCase() && /[A-Z]/.test(l)

/** Clean a cue or a typed name into the canonical character name ("Lakhan (V.O.)" → "LAKHAN"). */
export function normalizeCharacterName(raw: string): string {
  return raw
    .replace(EXTENSION, ' ')
    .replace(/[^A-Za-z0-9 .'&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function extractCharacterCues(text: string | null | undefined): string[] {
  const lines = (text || '').replace(/\r/g, '').split('\n').map((l) => l.trim())
  const found: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]
    if (!line || line.length > 40 || !isAllCaps(line) || isSlug(line) || isTransition(line)) continue
    if (/[.!?]$/.test(line.replace(EXTENSION, '').trim())) continue // an all-caps sentence, not a name

    // Next non-empty line must be dialogue: a parenthetical or mixed-case speech
    let j = i + 1
    while (j < lines.length && !lines[j]) j++
    if (j - i > 2 || j >= lines.length) continue // a blank-line gap means it wasn't a cue
    const next = lines[j]
    const isDialogue = /^\(.*\)$/.test(next) || (!isAllCaps(next) && !isSlug(next))
    if (!isDialogue) continue

    const name = normalizeCharacterName(line)
    if (!name || name.length < 2 || NOT_CHARACTERS.has(name) || /^\d+$/.test(name)) continue
    if (!seen.has(name)) {
      seen.add(name)
      found.push(name)
    }
  }
  return found
}
