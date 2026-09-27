import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ScheduleRedirect() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)

  if (projects && projects.length > 0) {
    redirect(`/projects/${projects[0].id}/schedule`)
  }
  redirect('/projects')
}
