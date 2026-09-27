import { parseSlugline } from './slugline'

export type ScreenplayBlockType =
  | 'SCENE_HEADING'
  | 'ACTION'
  | 'CHARACTER'
  | 'PARENTHETICAL'
  | 'DIALOGUE'
  | 'TRANSITION'
  | 'SHOT'
  | 'CENTERED'

export interface ScriptBlock {
  id: string
  type: ScreenplayBlockType
  text: string
}

const TRANSITION_REGEX =
  /^(?:CUT TO:|FADE IN:|FADE OUT:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|BLACKOUT|FADE TO BLACK)[\.:]?$/i

/**
 * Parses raw screenplay text into structured, editable screenplay blocks
 */
export function parseTextToBlocks(
  rawText: string,
  sceneNumber?: string,
  defaultHeading?: string
): ScriptBlock[] {
  const trimmed = rawText?.trim() || ''

  // Scaffolding for completely new/empty scenes
  if (!trimmed) {
    const heading = defaultHeading || 'INT. LOCATION - DAY'
    return [
      { id: crypto.randomUUID(), type: 'SCENE_HEADING', text: heading },
      { id: crypto.randomUUID(), type: 'ACTION', text: '' },
      { id: crypto.randomUUID(), type: 'CHARACTER', text: '' },
      { id: crypto.randomUUID(), type: 'DIALOGUE', text: '' },
    ]
  }

  const rawLines = trimmed.split(/\r?\n/)
  const blocks: ScriptBlock[] = []
  let prevType: ScreenplayBlockType = 'ACTION'

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const lineTrimmed = line.trim()

    // Skip empty lines in raw block list (blocks have their own vertical layout)
    if (!lineTrimmed) {
      continue
    }

    // Slugline / Scene Heading detection
    // Strip leading/trailing scene numbers if present e.g. "15 B INT. HOUSE - NIGHT 15 B"
    let cleanLine = lineTrimmed
    if (sceneNumber) {
      const numPattern = new RegExp(`^${sceneNumber}\\s+`, 'i')
      cleanLine = cleanLine.replace(numPattern, '').trim()
      const endNumPattern = new RegExp(`\\s+${sceneNumber}$`, 'i')
      cleanLine = cleanLine.replace(endNumPattern, '').trim()
    }

    const slug = parseSlugline(cleanLine)
    if (slug || cleanLine.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i)) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'SCENE_HEADING',
        text: cleanLine.toUpperCase(),
      })
      prevType = 'SCENE_HEADING'
      continue
    }

    // Transition detection
    if (TRANSITION_REGEX.test(lineTrimmed)) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'TRANSITION',
        text: lineTrimmed.toUpperCase(),
      })
      prevType = 'TRANSITION'
      continue
    }

    // Parenthetical detection
    if (lineTrimmed.startsWith('(') && lineTrimmed.endsWith(')')) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'PARENTHETICAL',
        text: lineTrimmed,
      })
      prevType = 'PARENTHETICAL'
      continue
    }

    // Character Cue detection
    // UPPERCASE or short standalone name before dialogue
    const isUpper =
      lineTrimmed === lineTrimmed.toUpperCase() &&
      /[A-Z]/.test(lineTrimmed) &&
      !lineTrimmed.endsWith('.') &&
      !lineTrimmed.endsWith(',') &&
      lineTrimmed.length <= 36

    // Also detect title-case single names if followed immediately by dialogue
    const isLikelyCharName =
      lineTrimmed.length <= 25 &&
      !/[.!?,;:]/.test(lineTrimmed) &&
      (isUpper || (prevType !== 'CHARACTER' && i + 1 < rawLines.length && rawLines[i + 1].trim().length > 0))

    if (isUpper || (isLikelyCharName && prevType !== 'CHARACTER' && prevType !== 'PARENTHETICAL')) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'CHARACTER',
        text: lineTrimmed.toUpperCase(),
      })
      prevType = 'CHARACTER'
      continue
    }

    // Dialogue (follows Character or Parenthetical)
    if (prevType === 'CHARACTER' || prevType === 'PARENTHETICAL') {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'DIALOGUE',
        text: lineTrimmed,
      })
      prevType = 'DIALOGUE'
      continue
    }

    // Action Narrative
    blocks.push({
      id: crypto.randomUUID(),
      type: 'ACTION',
      text: lineTrimmed,
    })
    prevType = 'ACTION'
  }

  // Ensure there is at least one block
  if (blocks.length === 0) {
    blocks.push({
      id: crypto.randomUUID(),
      type: 'ACTION',
      text: '',
    })
  }

  return blocks
}

/**
 * Serializes structured blocks back into standard Hollywood screenplay formatted text
 */
export function serializeBlocksToText(blocks: ScriptBlock[]): {
  heading: string
  description: string
} {
  let heading = ''
  const formattedLines: string[] = []

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const txt = b.text.trim()
    if (!txt && b.type !== 'SCENE_HEADING') continue

    switch (b.type) {
      case 'SCENE_HEADING': {
        const upperHeading = txt.toUpperCase()
        if (!heading) heading = upperHeading
        formattedLines.push(upperHeading)
        formattedLines.push('')
        break
      }
      case 'ACTION': {
        formattedLines.push(txt)
        formattedLines.push('')
        break
      }
      case 'CHARACTER': {
        // Uppercase character name with indent feel
        formattedLines.push(txt.toUpperCase())
        break
      }
      case 'PARENTHETICAL': {
        const wrapped = txt.startsWith('(') && txt.endsWith(')') ? txt : `(${txt.replace(/^\(+|\)+$/g, '')})`
        formattedLines.push(wrapped)
        break
      }
      case 'DIALOGUE': {
        formattedLines.push(txt)
        formattedLines.push('')
        break
      }
      case 'TRANSITION': {
        const trans = txt.endsWith(':') ? txt.toUpperCase() : `${txt.toUpperCase()}:`
        formattedLines.push(trans)
        formattedLines.push('')
        break
      }
      case 'SHOT': {
        formattedLines.push(txt.toUpperCase())
        formattedLines.push('')
        break
      }
      case 'CENTERED': {
        formattedLines.push(txt)
        formattedLines.push('')
        break
      }
      default: {
        formattedLines.push(txt)
        formattedLines.push('')
      }
    }
  }

  // Clean trailing empty lines
  while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
    formattedLines.pop()
  }

  const description = formattedLines.join('\n')
  return {
    heading: heading || 'SCENE',
    description: description || heading || 'SCENE',
  }
}

/**
 * Returns the recommended next element type when pressing Enter (standard screenwriting software conventions)
 */
export function getNextBlockType(currentType: ScreenplayBlockType): ScreenplayBlockType {
  switch (currentType) {
    case 'SCENE_HEADING':
      return 'ACTION'
    case 'CHARACTER':
      return 'DIALOGUE'
    case 'PARENTHETICAL':
      return 'DIALOGUE'
    case 'DIALOGUE':
      return 'CHARACTER'
    case 'ACTION':
      return 'ACTION'
    case 'TRANSITION':
      return 'SCENE_HEADING'
    case 'SHOT':
      return 'ACTION'
    case 'CENTERED':
      return 'ACTION'
    default:
      return 'ACTION'
  }
}

/**
 * Cycles through block types when pressing Tab (Screenwriter Tab-navigation)
 */
export function cycleBlockType(currentType: ScreenplayBlockType): ScreenplayBlockType {
  const cycle: ScreenplayBlockType[] = [
    'ACTION',
    'CHARACTER',
    'DIALOGUE',
    'PARENTHETICAL',
    'TRANSITION',
    'SCENE_HEADING',
    'SHOT',
    'CENTERED',
  ]
  const idx = cycle.indexOf(currentType)
  if (idx === -1 || idx === cycle.length - 1) return cycle[0]
  return cycle[idx + 1]
}
