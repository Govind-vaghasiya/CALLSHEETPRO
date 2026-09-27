import React from 'react'
import { notFound } from 'next/navigation'
import { getScriptById, getScriptScenes, getScriptPages } from '@/features/scripts/actions'
import { ScriptDetailView } from '@/features/scripts/components/script-detail-view'

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string; scriptId: string }>
}) {
  const { id, scriptId } = await params
  const script = await getScriptById(scriptId)

  if (!script || script.project_id !== id) {
    notFound()
  }

  const [scenes, pages] = await Promise.all([
    getScriptScenes(scriptId),
    getScriptPages(scriptId),
  ])

  return (
    <div className="flex-1 w-full max-w-full">
      <ScriptDetailView
        projectId={id}
        script={script}
        scenes={scenes}
        pages={pages}
      />
    </div>
  )
}
