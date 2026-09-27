/**
 * Industry Standard Hollywood Stripboard Color Logic:
 * - INT. DAY    -> Yellow  (bg-amber-400 text-zinc-950)
 * - INT. NIGHT  -> Blue    (bg-blue-600 text-white)
 * - EXT. DAY    -> Green   (bg-emerald-500 text-zinc-950)
 * - EXT. NIGHT  -> Red     (bg-rose-700 text-white)
 */
export function getStripColorClasses(intExt: string | null, timeOfDay: string | null): {
  container: string
  badge: string
} {
  const isExt = intExt === 'EXT' || intExt === 'INT_EXT'
  const isNight = timeOfDay === 'NIGHT' || timeOfDay === 'DUSK'

  if (isExt && isNight) {
    return {
      container: 'bg-rose-900 border-rose-700 text-white shadow-rose-950/40',
      badge: 'bg-rose-950 border-rose-600 text-rose-200',
    }
  }
  if (isExt && !isNight) {
    return {
      container: 'bg-emerald-500 border-emerald-400 text-zinc-950 font-bold shadow-emerald-950/40',
      badge: 'bg-emerald-900 border-emerald-700 text-emerald-100',
    }
  }
  if (!isExt && isNight) {
    return {
      container: 'bg-blue-600 border-blue-500 text-white shadow-blue-950/40',
      badge: 'bg-blue-950 border-blue-700 text-blue-100',
    }
  }
  // INT. DAY (Default) -> Vibrant Yellow
  return {
    container: 'bg-amber-400 border-amber-300 text-zinc-950 font-bold shadow-amber-950/40',
    badge: 'bg-amber-900 border-amber-700 text-amber-100',
  }
}
