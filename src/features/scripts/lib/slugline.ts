import type { IntExt, TimeOfDay } from '@/types/database'

/**
 * Robust industry-standard screenplay slugline parser (Client and Server safe)
 * Handles:
 * - INT. LOCATION - TIME
 * - EXT. LOCATION. TIME. (dot notation)
 * - INT./EXT. LOCATION - TIME
 * - 14 INT. LOCATION - NIGHT 14 (numbered scenes)
 * - SCENE 10 EXT. WOODS - DUSK
 */
export function parseSlugline(line: string): {
  explicitNum?: string
  intExt: IntExt
  locationName: string
  timeOfDay: TimeOfDay
} | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 180) return null

  // Must start with optional scene number followed by INT/EXT indicator
  const prefixMatch = trimmed.match(
    /^(?:(?:#?(\d+[A-Z]?|[A-Z]?\d+)\s+)|(?:SCENE\s+(\d+[A-Z]?|[A-Z]?\d+)\s+))?(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|I\/E\.?)\s+(.+)$/i
  )
  if (!prefixMatch) return null

  const explicitNum = prefixMatch[1] || prefixMatch[2]
  const prefix = prefixMatch[3].toUpperCase()
  const rest = prefixMatch[4]

  // Look for time of day indicator anywhere near the end (after dash, period, comma, or space)
  const timeMatch = rest.match(
    /[\s\.\-,]+(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|LATER|CONTINUOUS|MOMENTS\s+LATER|SAME\s+TIME|SUNSET|SUNRISE|MAGIC\s+HOUR)\b/i
  )

  let rawLoc = rest
  let timeOfDay: TimeOfDay = 'DAY'

  if (timeMatch) {
    const matchedTime = timeMatch[1].toUpperCase().trim()
    if (matchedTime.includes('NIGHT') || matchedTime.includes('EVENING')) timeOfDay = 'NIGHT'
    else if (
      matchedTime.includes('DAWN') ||
      matchedTime.includes('SUNRISE') ||
      matchedTime.includes('MORNING')
    )
      timeOfDay = 'DAWN'
    else if (matchedTime.includes('DUSK') || matchedTime.includes('SUNSET')) timeOfDay = 'DUSK'
    else if (matchedTime.includes('CONTINUOUS')) timeOfDay = 'CONTINUOUS'
    else if (matchedTime.includes('LATER')) timeOfDay = 'LATER'
    else if (matchedTime.includes('SAME')) timeOfDay = 'SAME_TIME'
    else timeOfDay = 'DAY'

    rawLoc = rest.slice(0, timeMatch.index).trim()
  }

  // Clean location name
  let locationName = rawLoc
    .replace(/[\.\-,]+$/, '')
    .replace(/^[\.\-,]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

  if (!locationName) locationName = 'UNSPECIFIED LOCATION'

  let intExt: IntExt = 'INT'
  if (prefix.includes('INT') && prefix.includes('EXT')) intExt = 'INT_EXT'
  else if (prefix.includes('I/E')) intExt = 'INT_EXT'
  else if (prefix.startsWith('EXT')) intExt = 'EXT'
  else intExt = 'INT'

  return { explicitNum, intExt, locationName, timeOfDay }
}
