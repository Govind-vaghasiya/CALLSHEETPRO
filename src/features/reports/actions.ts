'use server'

import { createClient } from '@/lib/supabase/server'
import type { DoodReportData } from './types'
import { buildDoodReport } from './lib/build-dood'

export async function getDoodReportDataAction(projectId: string): Promise<DoodReportData> {
  const supabase = await createClient()
  return buildDoodReport(supabase, projectId)
}
