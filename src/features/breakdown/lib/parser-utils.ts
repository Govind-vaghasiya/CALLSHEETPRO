import type { SceneElementType } from '@/types/database'
import { extractCharacterCues } from '@/features/characters/lib/character-cues'

export interface ExtractedElement {
  elementType: SceneElementType
  name: string
  description?: string
  aiConfidence: number
}

const COMMON_PROP_KEYWORDS = [
  'briefcase',
  'gun',
  'pistol',
  'rifle',
  'badge',
  'phone',
  'smartphone',
  'knife',
  'flashlight',
  'camera',
  'key',
  'keys',
  'laptop',
  'letter',
  'envelope',
  'glass',
  'bottle',
  'notebook',
  'radio',
  'walkie-talkie',
  'money',
  'cash',
  'wallet',
  'watch',
  'bag',
  'backpack',
  'suitcase',
]

const VEHICLE_KEYWORDS = [
  'car',
  'truck',
  'sedan',
  'van',
  'suv',
  'motorcycle',
  'bike',
  'cruiser',
  'chevy',
  'ford',
  'dodge',
  'toyota',
  'honda',
  'bmw',
  'mercedes',
  'police car',
  'cop car',
  'taxi',
  'cab',
  'helicopter',
  'ambulance',
]

const STUNT_KEYWORDS = [
  'fight',
  'chase',
  'jump',
  'fall',
  'tackle',
  'crash',
  'explosion',
  'stunt',
  'punch',
  'kick',
  'shootout',
  'gunfight',
  'brawl',
  'hit-and-run',
]

const VFX_SFX_KEYWORDS = [
  'explosion',
  'fire',
  'flames',
  'smoke',
  'rain',
  'storm',
  'green screen',
  'vfx',
  'cgi',
  'laser',
  'blast',
  'spark',
  'sparks',
  'lightning',
]

/**
 * Parses scene text and heading to heuristically extract production elements
 */
export function extractElementsFromSceneText(
  heading: string | null,
  description: string | null,
  locationName: string | null
): ExtractedElement[] {
  const elements: ExtractedElement[] = []
  const addedNames = new Set<string>()

  // Helper to push unique
  const addElement = (elementType: SceneElementType, name: string, confidence = 85, desc?: string) => {
    const clean = name.trim().toUpperCase()
    if (!clean || clean.length < 2 || addedNames.has(`${elementType}:${clean}`)) return
    addedNames.add(`${elementType}:${clean}`)
    elements.push({
      elementType,
      name: clean,
      description: desc,
      aiConfidence: confidence,
    })
  }

  // 1. Location Element
  if (locationName && locationName.trim()) {
    addElement('LOCATION', locationName.trim(), 95, 'Primary scene location')
  }

  const fullText = `${heading || ''}\n${description || ''}`

  // 2. Speaking characters: an all-caps cue followed by dialogue (see character-cues.ts)
  for (const name of extractCharacterCues(fullText)) {
    addElement('CAST', name, 90, 'Speaking character')
  }

  // 3. Explicit Tags e.g. PROP: Red Backpack, VEHICLE: Black Mustang
  const tagRegex = /(PROP|VEHICLE|WARDROBE|STUNT|VFX|SFX|EXTRA|EQUIPMENT|MAKEUP|ANIMAL):\s*([^\n.,;]+)/gi
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(fullText)) !== null) {
    const rawType = match[1].toUpperCase() as SceneElementType
    const rawName = match[2].trim()
    addElement(rawType, rawName, 95, 'Explicitly tagged element')
  }

  // 4. Keyword Detection in Action Lines
  const lowerText = fullText.toLowerCase()

  // Props
  COMMON_PROP_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      // Capitalize label e.g. "Briefcase"
      const label = keyword.charAt(0).toUpperCase() + keyword.slice(1)
      addElement('PROP', label, 75, `Detected "${keyword}" in scene text`)
    }
  })

  // Vehicles
  VEHICLE_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      const label = keyword.charAt(0).toUpperCase() + keyword.slice(1)
      addElement('VEHICLE', label, 80, `Detected vehicle "${keyword}"`)
    }
  })

  // Stunts
  STUNT_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      const label = keyword.charAt(0).toUpperCase() + keyword.slice(1)
      addElement('STUNT', `${label} Sequence`, 80, `Detected stunt activity "${keyword}"`)
    }
  })

  // VFX / SFX
  VFX_SFX_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      const label = keyword.charAt(0).toUpperCase() + keyword.slice(1)
      const type: SceneElementType = keyword === 'rain' || keyword === 'smoke' || keyword === 'fire' ? 'SFX' : 'VFX'
      addElement(type, `${label} Effect`, 80, `Detected effect "${keyword}"`)
    }
  })

  return elements
}
