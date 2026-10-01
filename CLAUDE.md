@AGENTS.md

# CallSheetPro project rules

Film/TV production scheduling app: Next.js 16 (App Router, Turbopack in dev) + Supabase. Developed on two computers, synced through GitHub (`git pull` before work, `git push` after). `.env.local` is never committed (the repo is public).

## One source of truth across modules
- Breakdown elements (CAST/EXTRA/STUNT/LOCATION/PROP/VEHICLE/ANIMAL/EQUIPMENT) link to Cast & Crew `resources` via `scene_requirements` (`src/features/breakdown/lib/resource-links.ts`); renames sync both ways.
- Cast: `scene_elements.character_id` → `characters` → `characters.actor_resource_id` → a PERSON resource (`src/features/characters/lib/characters.ts`). The actor is the scene requirement only while the character is cast.
- `resource_bookings` is derived by `syncProjectBookings()` — call it after any schedule or breakdown change.
- Call sheets, Day Out of Days, availability, analytics, the schedule assistant and guest links read these links and DB tables. Never use `localStorage`, in-memory stores, name matching, or fake/seeded data.
- Time-aware availability: `resource_availability.reason = 'HOURS'` rows are exact instants in `projects.timezone`; helpers in `features/availability/lib/windows.ts`, `features/scheduling/lib/time.ts`, `buildDayTimeline()`, `detectAvailabilityConflicts()`. Suggestions: `features/scheduling/lib/suggestions.ts`. Fixed start times: `shoot_day_scenes.fixed_start_time` (migration 021, code falls back if missing).
- Scenes belong to the project (unique `scene_number`); new drafts update them in place, so scene IDs survive drafts.

## UI conventions
- Light + dark themes via semantic tokens (`bg-background/card/muted`, `text-foreground/muted-foreground`, `border-border`); never hard-code `bg-zinc-9xx`/`text-white` for chrome. Screenplay paper, call sheet paper and stripboard strip colours are intentionally fixed.
- Popups: `useModalBehavior(isOpen, onClose)` (Esc, scroll lock, focus return) plus an X button top-right. Dropdowns: `useDismiss`.
- No `alert`/`confirm`/`prompt`: use `useFeedback()` (`confirm`, `notify`). Never fail silently — `notify(..., 'error')`.
- Printing: never `window.print()` the screen. Use `printHtml` / `printElement` from `src/lib/print/print-document.ts`; scripts use `src/features/scripts/lib/screenplay-print.ts`.
