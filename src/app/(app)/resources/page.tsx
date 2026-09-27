import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function TopLevelResourcesRedirect() {
  const supabase = await createClient()

  // 1. Fetch user's first project
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)

  if (projects && projects.length > 0) {
    redirect(`/projects/${projects[0].id}/resources`)
  }

  // Fallback to project list or new project setup
  redirect('/projects')
}
