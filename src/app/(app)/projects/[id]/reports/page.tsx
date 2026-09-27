import React from 'react'
import { getDoodReportDataAction } from '@/features/reports/actions'
import { ReportsHub } from '@/features/reports/components/reports-hub'

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const reportData = await getDoodReportDataAction(id)

  return (
    <div className="w-full">
      <ReportsHub reportData={reportData} />
    </div>
  )
}
