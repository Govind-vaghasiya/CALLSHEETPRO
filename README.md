# CALLSHEETPRO
Film and TV Production Scheduling app

Script → scene breakdown → cast & characters → stripboard schedule → call sheets, with
hour-by-hour availability, conflict checks, and schedule suggestions. Built with Next.js
and Supabase.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` (never commit it):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Set up the database: in the Supabase dashboard → SQL Editor, run the files in
   `supabase/migrations/` in order (`001` … `024`).

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Changelog

### 6 October 2026

**Master script with highlighted changes** (needs migration `025`)
- The project's working script is now the **Master Script**. Uploading a new draft offers
  **Merge into the master script** (default), **Compare side by side first**, or **Just store it**.
- Merged text is highlighted in **yellow** in the Script Reader, like tracked changes in Word.
  Each changed scene has **Accept** (the text becomes final) and **Reject** (back to the text
  before the merge; a scene the draft added is removed). **Accept all** handles every scene at
  once, "Show deletions" shows removed words struck through, and saving your own edit in the
  editor also makes a scene final.
- Scenes with changes to review are marked "changed"/"new" in the reader's scene list and
  "to review" on the scene cards, with a count and **Accept all** at the top.
- "Set as Active" is replaced by **Merge into Master** on each draft. Merging runs in short steps
  with clear errors (it used to time out silently on hosting).
- When merging everything, a scene the new draft dropped keeps its breakdown and schedule and is
  renamed (e.g. "5 OMITTED") if the new draft reuses its number; delete it in Compare Drafts.
- Compare Drafts is drawn like a screenplay page (centred character names, indented dialogue)
  with new words in yellow and removed words in red.
- Scene text is stored and shown without page headers, page numbers or (MORE)/(CONT'D) breaks.
- Character names typed in mixed case ("Govind") are recognised as speaking characters.
- Draft versions can have decimals (1.1, 5.6).
- Scripts page: the Master Script is now a wider fifth card next to the four summary cards, with
  **Open Master Script** on its right; the Version & Revision column uses plain black text with
  the revision colour as a dot.

> **After pulling:** run `supabase/migrations/025_script_versions_and_tracked_changes.sql` once in
> the Supabase SQL Editor — highlighted changes and decimal versions need it.

**Script drafts: compare and apply changes**
- New **Compare Drafts** tab on every script: pick any two drafts and read them side by side,
  scene by scene. Removed words are shown in red, added words in green. "Changes only" hides
  unchanged scenes; a scene list and `n` / `p` keys jump between changes.
- Scenes are paired by their text, not just their number, so renumbered or shifted scenes
  (e.g. one scene removed and every later number moves down) are matched correctly. Page
  breaks, running headers, (MORE)/(CONT'D) and revision asterisks are ignored.
- Each scene shows what changed (words added/removed, heading, length in eighths, speaking
  characters added/removed), its shoot days, whether that day's call sheet was already sent,
  and whether the app already has this version.
- Changes are applied scene by scene or all at once. Before applying you can change what the
  system decided: split or make scene pairs, pick which characters are added to or removed from
  the breakdown, and choose whether omitted scenes are deleted. Scenes keep their breakdown,
  Cast & Crew links and schedule placement.
- Uploading a new draft now asks what to do: **review the changes first** (default — nothing in
  the app changes until you apply), **apply everything now**, or **just store it**.
- Scenes still on an older draft's text are tagged (e.g. "v3 text") in the reader and scene cards.
- Drafts that are not current open read-only, showing their own scenes from the file, with a link
  to review and apply them. The Scripts list has a **Compare** button per draft and a banner when
  a newer draft is waiting to be applied.

**One-liners**
- One-liners now show on the script scene cards, in the screenplay reader (scene list and the
  active scene header) and on call sheets under the scene heading.
- In the reader's scene list the one-liner is the main (bold) line; the slugline is small and light.
- Script search now covers one-liners and uses the same forgiving search as the schedule
  ("scene 8", "sc 8A").

**Script page**
- The file name now sits next to the production name in the header
  ("Hiren Bhadani - FNP v10.2 12April22.pdf"); the scene count line and draft badges were removed
  to free up space.

**Breakdown**
- Linked items now say what they are and how often they are used ("Location · in 12 scenes",
  "Prop · only this scene") instead of "In Cast & Crew".
- Elements are laid out in three columns on wide screens.

**Fixes**
- Reader: moving or dragging a scene while the list was filtered by a search moved the wrong scene.
- Reader: "move to position" uses an in-app number box instead of the browser prompt.
- Saving a new scene order no longer fails silently.
- Fixed a hydration error on the Scripts list (dates now render the same on server and browser).
- The theme script now loads through `next/script`, removing the "script tag" console warning.
