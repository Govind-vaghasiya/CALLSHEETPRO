'use server'

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { forEachLimit } from '@/lib/async'
import { AI_KEY_MISSING_MESSAGE, getProjectAiKey } from '@/features/ai/lib/api-key'
import { ONE_LINER_MIGRATION_HINT, cleanSceneHeading, hasOneLinerColumns } from './lib/one-liners'

/**
 * Which scenes a request may write:
 * - 'fill'    only scenes without a one-liner
 * - 'redraft' every scene except ones a person wrote or edited
 * - 'force'   the scenes asked for, even hand-written ones (the user asked for this scene)
 */
export type OneLinerMode = 'fill' | 'redraft' | 'force'

export interface DraftOneLinersResult {
  drafted: Array<{ sceneId: string; synopsis: string }>
  error?: string
}

const SYSTEM_PROMPT = `You write one-liners for a film production's scene breakdown and one-liner report.

A one-liner tells the AD, line producer and department heads what happens in the scene, at a glance. Write one per scene:
- One sentence, present tense, ideally under 90 characters. Never more than 120.
- Say what happens and who drives it: the key action, turn or reveal.
- Use the characters' names as the script uses them (short names and nicknames are fine).
- Mention anything production-critical that happens on screen (a stunt, a car chase, fire, rain, a song, a crowd) when it is central to the scene.
- Do not repeat the slugline (INT/EXT, location, time of day), and do not open with "In this scene" or "We see" unless the scene is pure visuals.

Examples of the house style:
- The camera tracks along photographs on the wall, Sid's intro
- Adi thumps the bathroom door and complains from outside
- Sid and Adi abandon their car on the street and sneak away
- Sid tries to bribe Pingale. Adi stops him and admits his mistake bluntly

Return one entry per scene you were given, using its scene number exactly as given.`

const OneLinersSchema = z.object({
  one_liners: z.array(
    z.object({
      scene_number: z.string(),
      one_liner: z.string(),
    })
  ),
})

/**
 * Draft one-liners with AI for the given scenes (one batch — the breakdown screen sends
 * ONE_LINER_BATCH_SIZE scenes at a time and shows progress). Drafts are saved as source 'AI'.
 */
export async function draftOneLinersAction(
  projectId: string,
  sceneIds: string[],
  mode: OneLinerMode = 'fill'
): Promise<DraftOneLinersResult> {
  if (sceneIds.length === 0) return { drafted: [] }
  const apiKey = await getProjectAiKey(projectId)
  if (!apiKey) return { drafted: [], error: AI_KEY_MISSING_MESSAGE }

  const db = await createClient()
  if (!(await hasOneLinerColumns(db))) return { drafted: [], error: ONE_LINER_MIGRATION_HINT }

  const { data: rows, error: loadError } = await db
    .from('scenes')
    .select('id, scene_number, heading, description, synopsis, synopsis_source')
    .eq('project_id', projectId)
    .in('id', sceneIds)
  if (loadError) return { drafted: [], error: loadError.message }

  const scenes = (rows || []).filter((s) => {
    if (mode === 'force') return true
    if (mode === 'redraft') return s.synopsis_source !== 'USER'
    return !s.synopsis?.trim()
  })
  if (scenes.length === 0) return { drafted: [] }

  const sceneBlocks = scenes
    .map(
      (s) =>
        `<scene number="${s.scene_number}">\n${cleanSceneHeading(s.heading)}\n${(s.description || '').trim()}\n</scene>`
    )
    .join('\n\n')

  let parsed: z.infer<typeof OneLinersSchema> | null = null
  try {
    const client = new Anthropic({ apiKey })
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Short summaries: low effort keeps each batch fast
      output_config: { effort: 'low', format: betaZodOutputFormat(OneLinersSchema) },
      // If the model declines a scene (e.g. a violent one), the API retries it on a fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write a one-liner for each of these ${scenes.length} scenes.\n\n${sceneBlocks}`,
        },
      ],
    })
    if (response.stop_reason === 'refusal') {
      return { drafted: [], error: 'The AI declined to summarise these scenes. Write their one-liners by hand.' }
    }
    if (response.stop_reason === 'max_tokens') {
      return { drafted: [], error: 'The AI response was cut off. Try again.' }
    }
    parsed = response.parsed_output
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { drafted: [], error: 'The organization\'s AI key was rejected. An owner or admin can update it in Organization settings.' }
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { drafted: [], error: 'The AI is busy (rate limited). Wait a minute and try again.' }
    }
    if (error instanceof Anthropic.APIError) {
      return { drafted: [], error: `AI request failed (${error.status ?? 'network'}): ${error.message}` }
    }
    throw error
  }
  if (!parsed) return { drafted: [], error: 'The AI returned an unreadable answer. Try again.' }

  const byNumber = new Map(scenes.map((s) => [s.scene_number.trim().toUpperCase(), s]))
  const drafted: DraftOneLinersResult['drafted'] = []
  for (const item of parsed.one_liners) {
    const scene = byNumber.get(item.scene_number.trim().toUpperCase())
    const text = item.one_liner.trim()
    if (scene && text) drafted.push({ sceneId: scene.id, synopsis: text })
  }

  const failed: string[] = []
  await forEachLimit(drafted, 6, async (d) => {
    const { data, error } = await db
      .from('scenes')
      .update({ synopsis: d.synopsis, synopsis_source: 'AI', updated_at: new Date().toISOString() })
      .eq('id', d.sceneId)
      .select('id')
    if (error || !data?.length) failed.push(d.sceneId)
  })
  const saved = drafted.filter((d) => !failed.includes(d.sceneId))
  if (failed.length > 0) {
    return { drafted: saved, error: `Could not save ${failed.length} one-liner(s). You may not have edit access to this production.` }
  }
  return { drafted: saved }
}
