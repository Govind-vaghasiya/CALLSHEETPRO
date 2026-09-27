'use client'

import React from 'react'
import type { CallSheetFullData } from '../actions'
import {
  Calendar,
  Clock,
  Sun,
  Sunrise,
  Sunset,
  Film,
  Users,
  Utensils,
} from 'lucide-react'

interface CallSheetHeaderProps {
  data: CallSheetFullData
}

export function CallSheetHeader({ data }: CallSheetHeaderProps) {
  const { project, currentDay, shootDays, weatherInfo, keyContacts } = data

  const shootDateStr = new Date(currentDay.shoot_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="border-b-2 border-zinc-950 pb-4 space-y-4">
      {/* TOP PRODUCTION HEADER BLOCK */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950 text-white p-4 rounded-xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
              DAILY PRODUCTION CALL SHEET
            </span>
            <span className="text-[10px] font-mono uppercase text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
              {data.record.status === 'DRAFT' ? 'DRAFT' : `VERSION ${data.record.version}`}
            </span>
          </div>
          <h1 className="text-2xl font-black font-mono tracking-tight uppercase text-white">
            {project.name}
          </h1>
          <p className="text-xs font-mono text-zinc-400">
            {[data.unitName, data.location?.name].filter(Boolean).join(' · ') || 'Production unit'}
          </p>
        </div>

        {/* DAY # & CREW CALL HIGHLIGHT */}
        <div className="flex items-center gap-3">
          <div className="text-right space-y-0.5">
            <div className="text-xs font-mono font-bold text-amber-400">
              {shootDateStr}
            </div>
            <div className="text-2xl font-black font-mono text-white tracking-wider">
              DAY {currentDay.day_number || 1} <span className="text-zinc-500 text-base font-normal">OF {shootDays.length}</span>
            </div>
          </div>

          <div className="bg-amber-500 text-zinc-950 px-4 py-2 rounded-xl text-center shadow-lg border border-amber-400">
            <div className="text-[9px] font-mono font-black uppercase tracking-wider text-zinc-900">
              CREW CALL
            </div>
            <div className="text-xl font-mono font-black">
              {keyContacts.crewCall}
            </div>
          </div>
        </div>
      </div>

      {/* CREW CALL & WEATHER RIBBON */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
        {/* Left: Key Times & Contacts */}
        <div className="bg-zinc-100 border border-zinc-300 p-3 rounded-xl space-y-2 text-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1.5 font-bold">
            <span className="flex items-center gap-1.5 text-zinc-800 uppercase text-[11px]">
              <Clock className="size-3.5 text-amber-600" /> Key Times
            </span>
            <span className="text-[11px] text-zinc-600">Timezone: {project.timezone}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
            <div className="bg-white border border-zinc-200 p-1.5 rounded-lg shadow-2xs">
              <div className="text-[9px] text-zinc-500 uppercase">Breakfast</div>
              <div className="font-bold text-zinc-900">{keyContacts.breakfast}</div>
            </div>
            <div className="bg-white border border-zinc-200 p-1.5 rounded-lg shadow-2xs">
              <div className="text-[9px] text-zinc-500 uppercase">Crew Call</div>
              <div className="font-bold text-amber-600">{keyContacts.crewCall}</div>
            </div>
            <div className="bg-white border border-zinc-200 p-1.5 rounded-lg shadow-2xs">
              <div className="text-[9px] text-zinc-500 uppercase flex items-center justify-center gap-0.5">
                <Utensils className="size-2.5 text-zinc-400" /> Lunch
              </div>
              <div className="font-bold text-zinc-900">{keyContacts.lunch}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] pt-1 border-t border-zinc-300">
            <div><span className="text-zinc-500 uppercase">Director</span><div className="font-bold truncate">{keyContacts.director}</div></div>
            <div><span className="text-zinc-500 uppercase">Producer</span><div className="font-bold truncate">{keyContacts.producer}</div></div>
            <div><span className="text-zinc-500 uppercase">1st AD</span><div className="font-bold truncate">{keyContacts.firstAD}</div></div>
          </div>
        </div>

        {/* Right: Weather & Solar Info */}
        <div className="bg-zinc-100 border border-zinc-300 p-3 rounded-xl space-y-2 text-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-1.5 font-bold">
            <span className="flex items-center gap-1.5 text-zinc-800 uppercase text-[11px]">
              <Sun className="size-3.5 text-amber-500" /> Weather & Solar Info
            </span>
            <span className="text-[11px] text-amber-600 font-bold">{weatherInfo.temp}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 px-1">
            <span className="text-zinc-600 truncate">{weatherInfo.condition}</span>
            <div className="flex items-center gap-3 shrink-0 font-bold">
              <span className="flex items-center gap-1 text-amber-700">
                <Sunrise className="size-3.5" /> {weatherInfo.sunrise}
              </span>
              <span className="flex items-center gap-1 text-orange-700">
                <Sunset className="size-3.5" /> {weatherInfo.sunset}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
