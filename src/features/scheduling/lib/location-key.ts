/**
 * Location names as people mean them, for grouping scenes into shoot days.
 *
 * Script imports leave noise in location names: scene numbers from the margins ("SUSAN'S BEDROOM
 * 12 12"), part markers ("(PART A)"), and story-time words ("- RESUME", "- EARLIER THAT MORNING",
 * "- MOVING"). None of that changes where the crew has to be.
 *
 *   cleanLocationName("OSWALD’S HOUSE - SASKIA’S BEDROOM - THE NIGHT BEFORE 10 10")
 *     → "OSWALD'S HOUSE - SASKIA'S BEDROOM"          (the set)
 *   locationSite(…) → "OSWALD'S HOUSE"               (the site: moving between its rooms is cheap)
 */

// A segment after " - " that describes story time or camera movement, not a place
const TIME_SEGMENT =
  /^(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|SUNSET|SUNRISE|MAGIC HOUR|NOON|MIDNIGHT|LATER|EARLIER|CONTINUOUS|CONT'?D|MOMENTS? LATER|SAME TIME|SAME|RESUME|RESUMING|MOVING|TRAVELL?ING|DRIVING|FLASHBACK|FLASH BACK|PRESENT|PRESENT DAY|INTERCUT|THE NEXT|NEXT|THAT |THE NIGHT BEFORE|THE DAY BEFORE|THE FOLLOWING|A FEW|ONE |TWO |SEVERAL|YEARS|MONTHS|WEEKS|DAYS LATER)/

export function cleanLocationName(raw: string | null | undefined): string {
  let s = (raw || '')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\t ]+/g, ' ')
    .toUpperCase()
    .replace(/\(\s*PART\s+[A-Z0-9]+\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // A heading used as the name: drop the scene number and INT./EXT.
  s = s.replace(/^(?:SCENE\s+)?#?[A-Z]?\d+[A-Z]{0,2}\s+(?=(?:INT|EXT|I\/E))/, '')
  s = s.replace(/^(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s+/, '')

  // Margin scene numbers copied into the heading: "… 14 14", "… 24A 24A" (a repeated token only,
  // so real names like "ROUTE 66" survive)
  s = s.replace(/\s+([A-Z]?\d+[A-Z]{0,2})\s+\1\s*$/, '').trim()

  const parts = s
    .split(/\s+[-–—]+\s+|\s+[-–—]+$|^[-–—]+\s+/)
    .map((p) => p.replace(/^[\s.,:;]+|[\s.,:;]+$/g, '').trim())
    .filter(Boolean)
  // A segment cut short by the import ("… - THE" from "THE NIGHT BEFORE") carries no place either
  const kept = parts.filter((p, i) => i === 0 || !(TIME_SEGMENT.test(p) || /^(THE|A|AN|THAT|THIS)$/.test(p)))
  return kept.join(' - ') || 'UNSPECIFIED LOCATION'
}

/** The site a set belongs to — the first part of the name ("OSWALD'S HOUSE" for its bedroom). */
export function locationSite(cleanName: string): string {
  return cleanName.split(' - ')[0]
}
