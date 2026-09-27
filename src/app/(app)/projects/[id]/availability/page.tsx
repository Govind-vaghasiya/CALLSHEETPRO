import React from 'react'
import { getAvailabilityDataAction } from '@/features/availability/actions'
import { AvailabilityGrid } from '@/features/availability/components/availability-grid'

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const availabilityData = await getAvailabilityDataAction(id)

  return (
    <div className="w-full">
      <AvailabilityGrid initialData={availabilityData} projectId={id} />
    </div>
  )
}
