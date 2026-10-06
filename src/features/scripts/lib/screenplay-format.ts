import { parseSlugline } from './slugline'
import { isMixedCaseCue } from '@/features/characters/lib/character-cues'

export type ScreenplayLineType =
  | 'SLUGLINE'
  | 'TRANSITION'
  | 'CHARACTER'
  | 'PARENTHETICAL'
  | 'DIALOGUE'
  | 'ACTION'
  | 'PRINT_FOOTER'
  | 'EMPTY'

export interface FormattedScreenplayLine {
  text: string
  type: ScreenplayLineType
  matchedSceneNumber?: string
  intExt?: string
  timeOfDay?: string
}

const TRANSITION_REGEX =
  /^(?:CUT TO:|FADE IN:|FADE OUT:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|BLACKOUT|FADE TO BLACK)[\.:]?$/i

/**
 * Classify and format raw text lines from screenplay pages
 * according to industry-standard Hollywood script formatting rules
 */
export function classifyScreenplayLines(
  rawText: string,
  pageScenes: { sceneNumber: string; heading: string }[]
): FormattedScreenplayLine[] {
  const lines = rawText.split(/\r?\n/)
  const formatted: FormattedScreenplayLine[] = []
  let prevType: ScreenplayLineType = 'EMPTY'

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!trimmed) {
      formatted.push({ text: '', type: 'EMPTY' })
      prevType = 'EMPTY'
      continue
    }

    // Check for print/browser artifacts (e.g. "9/17/26, 3:59 PM ... about:blank")
    if (
      trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
      trimmed.includes('about:blank') ||
      trimmed.match(/^https?:\/\//i)
    ) {
      formatted.push({ text: trimmed, type: 'PRINT_FOOTER' })
      continue
    }

    // Check for slugline (Scene Heading)
    const slug = parseSlugline(trimmed)
    if (slug || trimmed.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i)) {
      // Find matching scene number if available
      let matchedSceneNumber = slug?.explicitNum
      if (!matchedSceneNumber) {
        // Match against page scenes
        const normalizedTrimmed = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        const found = pageScenes.find((s) => {
          const normHeading = s.heading.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
          return (
            normHeading.includes(normalizedTrimmed) ||
            normalizedTrimmed.includes(normHeading)
          )
        })
        if (found) {
          matchedSceneNumber = found.sceneNumber
        }
      }

      formatted.push({
        text: trimmed,
        type: 'SLUGLINE',
        matchedSceneNumber,
        intExt: slug?.intExt,
        timeOfDay: slug?.timeOfDay,
      })
      prevType = 'SLUGLINE'
      continue
    }

    // Transitions (e.g. CUT TO:, FADE IN:)
    if (TRANSITION_REGEX.test(trimmed)) {
      formatted.push({ text: trimmed, type: 'TRANSITION' })
      prevType = 'TRANSITION'
      continue
    }

    // Parentheticals (e.g. (softly), (V.O.), (beat))
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      formatted.push({ text: trimmed, type: 'PARENTHETICAL' })
      prevType = 'PARENTHETICAL'
      continue
    }

    // Character cue: All upper-case, short (<= 35 chars), letters only + optional (V.O./O.S.)
    const isUpper =
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed) &&
      !trimmed.endsWith('.') &&
      !trimmed.endsWith(',') &&
      trimmed.length <= 36

    // A name typed in mixed case ("Govind") is shown as the cue it is
    if ((isUpper && prevType !== 'CHARACTER') || (prevType !== 'CHARACTER' && isMixedCaseCue(lines, i))) {
      formatted.push({ text: isUpper ? trimmed : trimmed.toUpperCase(), type: 'CHARACTER' })
      prevType = 'CHARACTER'
      continue
    }

    // Dialogue: Follows a Character cue or Parenthetical
    if (prevType === 'CHARACTER' || prevType === 'PARENTHETICAL') {
      formatted.push({ text: trimmed, type: 'DIALOGUE' })
      prevType = 'DIALOGUE'
      continue
    }

    if (prevType === 'DIALOGUE') {
      // Action reset heuristic: line is wide (> 46 chars) and starts with third-person narrative word
      if (
        trimmed.length > 46 &&
        /^(The |She |He |They |It |A |As |When |Suddenly |We |In |At |After )/.test(
          trimmed
        )
      ) {
        formatted.push({ text: trimmed, type: 'ACTION' })
        prevType = 'ACTION'
      } else {
        formatted.push({ text: trimmed, type: 'DIALOGUE' })
        prevType = 'DIALOGUE'
      }
      continue
    }

    // General Action / Scene Description
    formatted.push({ text: trimmed, type: 'ACTION' })
    prevType = 'ACTION'
  }

  return formatted
}
