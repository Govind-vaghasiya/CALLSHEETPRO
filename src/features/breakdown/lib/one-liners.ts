/**
 * One-liners: the short scene summaries ADs use on the breakdown and the one-liner report,
 * and the scene facts printed next to them (page length in eighths, time of day as written).
 * Client and server safe.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { parseSlugline } from '@/features/scripts/lib/slugline'

type SceneLike = {
  heading: string | null
  description: string | null
  time_of_day: string | null
  page_start: number | null
  page_end: number | null
  page_eighths?: number | null
  time_of_day_label?: string | null
}

/** Migration 023 adds the one-liner columns; code keeps working without them until it is run. */
export const ONE_LINER_MIGRATION_HINT =
  'One-liners need a one-time database update: run supabase/migrations/023_scene_oneliners.sql in the Supabase SQL Editor.'

/** Scenes per AI request: keeps each call well inside a serverless function's time limit. */
export const ONE_LINER_BATCH_SIZE = 6

export async function hasOneLinerColumns(sb: SupabaseClient<Database>): Promise<boolean> {
  const { error } = await sb.from('scenes').select('synopsis, synopsis_source, page_eighths, time_of_day_label').limit(1)
  return !error
}

/** The slugline without the scene numbers printed in its margins ("… MORNING 1 1" → "… MORNING"). */
export function cleanSceneHeading(heading: string | null | undefined): string {
  if (!heading) return ''
  return parseSlugline(heading)?.heading ?? heading.trim()
}

/** "Early Morning" — the slugline's own wording, falling back to the scheduling category. */
export function sceneTimeLabel(scene: SceneLike): string {
  const raw = scene.time_of_day_label || parseSlugline(scene.heading || '')?.timeLabel || scene.time_of_day || ''
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Scene length in eighths. Counted from the script on upload; scenes uploaded before that
 * was recorded get an estimate from their text (≈ 6 filled lines per eighth of a page).
 */
export function sceneEighths(scene: SceneLike): { eighths: number; estimated: boolean } {
  if (scene.page_eighths && scene.page_eighths > 0) return { eighths: scene.page_eighths, estimated: false }
  const filled = (scene.description || '').split(/\r?\n/).filter((l) => l.trim()).length
  return { eighths: Math.max(1, Math.round(filled / 6)), estimated: true }
}

/** 6 → "6/8", 8 → "1", 10 → "1 2/8" */
export function formatEighths(eighths: number): string {
  const whole = Math.floor(eighths / 8)
  const rest = eighths % 8
  if (!rest) return String(whole)
  return whole ? `${whole} ${rest}/8` : `${rest}/8`
}
