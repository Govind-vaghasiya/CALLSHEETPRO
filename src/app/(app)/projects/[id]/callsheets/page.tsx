import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCallSheetDataAction } from '@/features/callsheets/actions'
import { CallSheetView } from '@/features/callsheets/components/call-sheet-view'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, FileText } from 'lucide-react'

export default async function CallSheetsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const initialData = await getCallSheetDataAction(id)

  if (!initialData) {
    return (
      <div className="p-12 max-w-xl mx-auto text-center font-mono text-xs border border-border rounded-2xl bg-background space-y-4 shadow-2xl">
        <FileText className="size-10 text-amber-600 dark:text-amber-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground uppercase">No Call Sheets Available Yet</h2>
          <p className="text-muted-foreground">
            Call sheets are generated automatically from production shoot days. Create shoot days and assign scenes in the **Stripboard & Schedule Board** to generate daily Call Sheets.
          </p>
        </div>

        <div className="pt-2">
          <Link href={`/projects/${id}/schedule`}>
            <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono cursor-pointer">
              <Calendar className="size-4 mr-1.5" />
              <span>Go to Stripboard & Schedule</span>
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <CallSheetView initialData={initialData} projectId={id} />
}
