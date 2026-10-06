import React from 'react'
import { notFound } from 'next/navigation'
import { getScriptById, getScriptPages, getProjectScenes, getProjectScripts } from '@/features/scripts/actions'
import { draftScenesFromPages } from '@/features/scripts/lib/draft-scenes'
import { ScriptDetailView } from '@/features/scripts/components/script-detail-view'

export default async function ScriptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; scriptId: string }>
  searchParams: Promise<{ tab?: string; base?: string }>
}) {
  const { id, scriptId } = await params
  const { tab, base } = await searchParams
  const script = await getScriptById(scriptId)

  if (!script || script.project_id !== id) {
    notFound()
  }

  // The current draft shows the project's scenes (editable) — including ones still on an older
  // draft's text because their changes have not been applied yet. Any other draft is shown as
  // written, read from its own pages and read-only.
  const [projectScenes, pages, drafts] = await Promise.all([getProjectScenes(id), getScriptPages(scriptId), getProjectScripts(id)])
  const readOnly = !script.is_current
  const scenes = readOnly ? draftScenesFromPages(script, pages, projectScenes) : projectScenes
  const initialTab = tab === 'compare' ? 'COMPARE' : tab === 'reader' ? 'READER' : 'SCENES'

  return (
    <div className="flex-1 w-full max-w-full">
      <ScriptDetailView
        projectId={id}
        script={script}
        scenes={scenes}
        pages={pages}
        drafts={drafts}
        initialTab={initialTab}
        compareBaseId={base}
        readOnly={readOnly}
      />
    </div>
  )
}
