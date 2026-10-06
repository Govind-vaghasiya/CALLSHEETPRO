'use client'

import React from 'react'
import type { CallSheetFullData } from '../lib/build-call-sheet'
import { CallSheetHeader } from './call-sheet-header'
import { getStripColorClasses } from '@/features/scheduling/lib/strip-colors'
import { Cross, Phone, MapPin, Users, Shield, Utensils, FileText } from 'lucide-react'

/** The printable call sheet page (shared by the production app and the guest viewer). */
export function CallSheetPaper({ data }: { data: CallSheetFullData }) {
  const { currentDay, scenes, castMembers, hospitalInfo } = data

  // Total pages for the day
  const totalPages = scenes.reduce((sum, item) => {
    const start = item.scene.page_start || 1
    const end = item.scene.page_end || start
    return sum + Math.max(0.1, end - start + 0.1)
  }, 0)

  return (
    <div className="print-area w-full max-w-[960px] mx-auto bg-white text-zinc-950 font-sans shadow-2xl rounded-2xl border border-zinc-300 p-6 md:p-8 space-y-5">
      {/* HEADER SECTION */}
      <CallSheetHeader data={data} />

      {/* EMERGENCY HOSPITAL & SAFETY BLOCK */}
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs font-mono space-y-1.5 text-zinc-900">
        <div className="flex items-center justify-between font-bold border-b border-rose-200 pb-1 text-rose-950">
          <span className="flex items-center gap-1.5 uppercase text-[11px] font-black">
            <Cross className="size-3.5 text-rose-600" /> Nearest Emergency Hospital & Safety Route
          </span>
          <span className="text-[10px] bg-rose-200 text-rose-950 px-2 py-0.5 rounded font-bold">
            ESTIMATED DRIVE: {hospitalInfo.distance}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] pt-0.5">
          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-500 uppercase font-bold">Hospital Name</div>
            <div className="font-bold text-zinc-900">{hospitalInfo.name}</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-500 uppercase font-bold">Address & Location</div>
            <div className="text-zinc-800 flex items-center gap-1 truncate">
              <MapPin className="size-3 text-rose-600 shrink-0" />
              {hospitalInfo.address}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-500 uppercase font-bold">ER Direct Line</div>
            <div className="font-bold text-rose-800 flex items-center gap-1">
              <Phone className="size-3" /> {hospitalInfo.phone}
            </div>
          </div>
        </div>
      </div>

      {/* SCENE SCHEDULE GRID */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 border-b-2 border-zinc-950 pb-1">
          <span className="flex items-center gap-1.5">
            <FileText className="size-4 text-amber-600" /> Day {currentDay.day_number || 1} Scene Shooting Schedule
          </span>
          <span className="text-zinc-600">Total Pages: {totalPages.toFixed(1)} Pgs</span>
        </div>

        <div className="overflow-x-auto border border-zinc-300 rounded-xl">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-zinc-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-800">Sc #</th>
                <th className="py-2 px-3 border-r border-zinc-800">I/E</th>
                <th className="py-2 px-3 border-r border-zinc-800">Scene Heading & Description</th>
                <th className="py-2 px-3 border-r border-zinc-800">Location</th>
                <th className="py-2 px-3 border-r border-zinc-800 text-center">Pgs</th>
                <th className="py-2 px-3">Cast IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {scenes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500 text-xs italic">
                    No scenes scheduled for Shoot Day {currentDay.day_number} yet.
                  </td>
                </tr>
              ) : (
                scenes.map((item) => {
                  const stripColors = getStripColorClasses(
                    item.scene.int_ext,
                    item.scene.time_of_day
                  )

                  return (
                    <tr key={item.assignmentId} className="hover:bg-zinc-50">
                      <td className="py-2 px-3 border-r border-zinc-200 font-black text-amber-700">
                        #{item.scene.scene_number}
                      </td>
                      <td className="py-2 px-3 border-r border-zinc-200">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${stripColors.badge}`}>
                          {item.scene.int_ext || 'INT'} · {item.scene.time_of_day || 'DAY'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-zinc-200 text-zinc-900">
                        <div className="font-bold uppercase">{item.scene.heading || 'UNTITLED SCENE'}</div>
                        {item.scene.synopsis?.trim() && (
                          <div className="mt-0.5 font-sans text-[11px] text-zinc-600">{item.scene.synopsis}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-zinc-200 text-zinc-700 truncate">
                        {item.scene.location_name || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-zinc-200 text-center font-bold text-zinc-900">
                        {((item.scene.page_end || 1) - (item.scene.page_start || 1) + 0.1).toFixed(1)}
                      </td>
                      <td className="py-2 px-3 text-zinc-800 font-bold">
                        {item.castIds.length > 0 ? item.castIds.join(', ') : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CAST CALL TABLE */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 border-b-2 border-zinc-950 pb-1">
          <span className="flex items-center gap-1.5">
            <Users className="size-4 text-amber-600" /> Cast Calls & Talent Schedule
          </span>
          <span className="text-[10px] text-zinc-500 font-normal">
            Status: W (Work), H (Hold), P (Pickup), D (Drop)
          </span>
        </div>

        <div className="overflow-x-auto border border-zinc-300 rounded-xl">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-zinc-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-800 text-center">ID</th>
                <th className="py-2 px-3 border-r border-zinc-800">Character Name</th>
                <th className="py-2 px-3 border-r border-zinc-800">Actor Name</th>
                <th className="py-2 px-3 border-r border-zinc-800 text-center">St</th>
                <th className="py-2 px-3 border-r border-zinc-800">Pickup</th>
                <th className="py-2 px-3 border-r border-zinc-800">HMU Call</th>
                <th className="py-2 px-3 border-r border-zinc-800">On Set</th>
                <th className="py-2 px-3">Special Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {castMembers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-zinc-500 text-xs italic">
                    No cast tagged in today&apos;s scenes. Tag cast in the Scene Breakdown.
                  </td>
                </tr>
              )}
              {castMembers.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 border-r border-zinc-200 text-center font-bold text-amber-700">
                    #{member.castId}
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-bold uppercase text-zinc-900">
                    {member.characterName}
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-700">
                    {member.actorName}
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded font-black text-[9px] ${
                        member.status === 'W'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : member.status === 'SW' || member.status === 'SWF'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : member.status === 'H'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-700">
                    {member.pickupTime}
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-700">
                    {member.hmuCallTime}
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-bold text-zinc-900">
                    {member.onSetCallTime}
                  </td>
                  <td className="py-2 px-3 text-zinc-600 text-[10px]">
                    {member.notes || 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEPARTMENT ANNOUNCEMENTS & NOTES */}
      <div className="space-y-2 pt-2">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 border-b-2 border-zinc-950 pb-1">
          Department Notes & Production Announcements
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl space-y-1">
            <div className="font-bold text-zinc-900 flex items-center gap-1 text-[11px]">
              <MapPin className="size-3.5 text-zinc-700" /> Shooting Location
            </div>
            <p className="text-[11px] text-zinc-800 font-bold leading-normal">
              {data.location?.name || 'Not set — tag a location in the breakdown'}
            </p>
            {data.location && <p className="text-[10px] text-zinc-600 leading-normal">{data.location.address}</p>}
          </div>

          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl space-y-1">
            <div className="font-bold text-zinc-900 flex items-center gap-1 text-[11px]">
              <Shield className="size-3.5 text-amber-600" /> Special Instructions & Safety
            </div>
            <p className="text-[10px] text-zinc-600 leading-normal whitespace-pre-line">
              {data.details.specialInstructions || 'None'}
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl space-y-1">
            <div className="font-bold text-zinc-900 flex items-center gap-1 text-[11px]">
              <Utensils className="size-3.5 text-emerald-600" /> Catering
            </div>
            <p className="text-[10px] text-zinc-600 leading-normal">
              Breakfast: {data.keyContacts.breakfast} · Lunch: {data.keyContacts.lunch}
            </p>
          </div>
        </div>

        {currentDay.notes && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs font-mono text-amber-950 space-y-1">
            <div className="font-bold uppercase text-[11px]">Producer / 1st AD Announcements:</div>
            <p className="text-[11px] leading-relaxed">{currentDay.notes}</p>
          </div>
        )}
      </div>

      {/* CALL SHEET FOOTER */}
      <div className="border-t border-zinc-300 pt-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <div>
          {data.record.publishedAt
            ? `PUBLISHED V${data.record.version} · ${new Date(data.record.publishedAt).toLocaleString()}`
            : 'DRAFT — NOT YET PUBLISHED'}
        </div>
        <div className="font-bold text-zinc-800">
          CONFIDENTIAL — FOR CAST & CREW USE ONLY
        </div>
      </div>
    </div>
  )
}
