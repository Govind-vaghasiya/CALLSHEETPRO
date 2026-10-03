'use client'

import React, { useActionState, useState, useTransition } from 'react'
import {
  updateProjectSettingsAction,
  deleteProjectAction,
  type ProjectActionState,
} from '@/features/projects/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Sliders,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  Clock,
  ShieldAlert,
  Globe,
  Coins,
} from 'lucide-react'
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal'
import { UnionRulesForm } from './union-rules-form'
import { ProductionCalendarForm } from './production-calendar-form'

interface ProjectSettingsFormProps {
  project: {
    id: string
    name: string
    description?: string | null
    status: string
    project_type: string
    timezone?: string | null
    start_date: string | null
    target_end_date: string | null
    project_settings?: {
      id?: string
      default_call_time?: string
      min_turnaround_hours?: number
      max_shooting_hours?: number
      company_move_threshold?: number
      currency?: string
    } | null
  }
  defaultStartDate?: string
  defaultWrapDate?: string
  /** The organization's AI key section (rendered by the page, which can read the org settings) */
  aiSection?: React.ReactNode
}

export function ProjectSettingsForm({
  project,
  defaultStartDate = '',
  defaultWrapDate = '',
  aiSection,
}: ProjectSettingsFormProps) {
  const updateActionWithId = updateProjectSettingsAction.bind(null, project.id)
  const [state, formAction, isPending] = useActionState<ProjectActionState, FormData>(
    updateActionWithId,
    {}
  )

  // Accidental deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeletePending, startDeleteTransition] = useTransition()

  const handleDeleteProject = () => {
    startDeleteTransition(async () => {
      await deleteProjectAction(project.id)
    })
  }

  const settings = project.project_settings
  const initialStartDate = project.start_date ? project.start_date.slice(0, 10) : defaultStartDate
  const initialWrapDate = project.target_end_date ? project.target_end_date.slice(0, 10) : defaultWrapDate

  return (
    <div className="space-y-8 w-full max-w-full">
      <div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          Production Settings & Shooting Rules
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure project details and union-compliant scheduling rules for SAG-AFTRA, IATSE, and DGA.
        </p>
      </div>

      <Card className="border-border bg-card/60 shadow-xl">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono uppercase tracking-wider font-semibold">
            <Sliders className="size-4" /> Production Metadata
          </div>
          <CardTitle className="text-lg text-foreground">General Information</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Basic details about your production title, format, dates, and regional parameters.
          </CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="space-y-6 pt-6">
            {state?.error && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <span>{state.error}</span>
              </div>
            )}

            {state?.success && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                <span>{state.success}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Production Name
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={project.name}
                required
                className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                Production Synopsis / Logline
              </Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project.description || ''}
                placeholder="Brief synopsis or production notes..."
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectType" className="text-sm font-medium text-foreground">
                  Production Type
                </Label>
                <select
                  id="projectType"
                  name="projectType"
                  defaultValue={project.project_type || 'FEATURE'}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="FEATURE">Feature Film</option>
                  <option value="SHORT">Short Film</option>
                  <option value="TV">Television Series</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="MUSIC_VIDEO">Music Video</option>
                  <option value="DOCUMENTARY">Documentary</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium text-foreground">
                  Production Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={project.status || 'PRE_PRODUCTION'}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="DEVELOPMENT">Development</option>
                  <option value="PRE_PRODUCTION">Pre-Production</option>
                  <option value="PRODUCTION">In Production</option>
                  <option value="POST">Post-Production</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-amber-700 dark:text-amber-400" /> Timezone
                </Label>
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue={project.timezone || 'Asia/Kolkata'}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="Asia/Kolkata">India (IST) — Mumbai, Delhi, Bengaluru</option>
                  <option value="America/New_York">Eastern Time (EST/EDT) — NY, Atlanta</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT) — LA, Vancouver</option>
                  <option value="America/Chicago">Central Time (CST/CDT) — Chicago, Austin</option>
                  <option value="America/Denver">Mountain Time (MST/MDT) — Denver</option>
                  <option value="Europe/London">London / UK (GMT/BST)</option>
                  <option value="Europe/Paris">Central European Time (CET) — Paris, Berlin</option>
                  <option value="Asia/Dubai">Gulf Standard Time (GST) — Dubai</option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST) — Tokyo</option>
                  <option value="Asia/Singapore">Singapore Time (SGT) — Singapore</option>
                  <option value="Australia/Sydney">Australian Eastern (AEST) — Sydney</option>
                  <option value="UTC">Universal Time (UTC)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Coins className="size-3.5 text-amber-700 dark:text-amber-400" /> Currency
                </Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={settings?.currency || 'INR'}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                  <option value="CAD">CAD ($) — Canadian Dollar</option>
                  <option value="AUD">AUD ($) — Australian Dollar</option>
                  <option value="JPY">JPY (¥) — Japanese Yen</option>
                  <option value="AED">AED (د.إ) — UAE Dirham</option>
                  <option value="SGD">SGD ($) — Singapore Dollar</option>
                  <option value="NZD">NZD ($) — New Zealand Dollar</option>
                  <option value="CHF">CHF (Fr.) — Swiss Franc</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium text-foreground">
                  Principal Photography Start
                </Label>
                <DatePicker
                  id="startDate"
                  name="startDate"
                  defaultValue={initialStartDate}
                  placeholder="Pick shoot start date..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetWrapDate" className="text-sm font-medium text-foreground">
                  Target Wrap Date
                </Label>
                <DatePicker
                  id="targetWrapDate"
                  name="targetWrapDate"
                  defaultValue={initialWrapDate}
                  placeholder="Pick target wrap date..."
                />
              </div>
            </div>

            {/* Shooting Rules Section */}
            <div className="pt-6 border-t border-border/80 space-y-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono uppercase tracking-wider font-semibold">
                <Clock className="size-4" /> Union & Scheduling Rules Engine
              </div>
              <p className="text-xs text-muted-foreground">
                These constraints drive automatic conflict warnings across your stripboard and shoot days.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultCallTime" className="text-xs font-medium text-subtle-foreground">
                    Default Call Time
                  </Label>
                  <Input
                    id="defaultCallTime"
                    name="defaultCallTime"
                    type="time"
                    defaultValue={settings?.default_call_time?.slice(0, 5) || '07:00'}
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">Crew call on shoot days.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minTurnaroundHours" className="text-xs font-medium text-subtle-foreground">
                    Min Turnaround (Hrs)
                  </Label>
                  <Input
                    id="minTurnaroundHours"
                    name="minTurnaroundHours"
                    type="number"
                    min={8}
                    max={24}
                    defaultValue={settings?.min_turnaround_hours || 12}
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">SAG-AFTRA 12h rule.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxWorkingHours" className="text-xs font-medium text-subtle-foreground">
                    Max Daily Hours
                  </Label>
                  <Input
                    id="maxWorkingHours"
                    name="maxWorkingHours"
                    type="number"
                    min={6}
                    max={18}
                    defaultValue={settings?.max_shooting_hours || 10}
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">Overtime threshold.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyMoveThreshold" className="text-xs font-medium text-subtle-foreground">
                    Company Move (Mins)
                  </Label>
                  <Input
                    id="companyMoveThreshold"
                    name="companyMoveThreshold"
                    type="number"
                    min={15}
                    max={180}
                    defaultValue={settings?.company_move_threshold || 30}
                    className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">Travel time buffer.</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border/80 pt-4 pb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Settings update immediately across your stripboards, schedule, and call sheets.
            </p>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6 shadow-lg shadow-amber-500/15 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving Settings...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Production calendar: work week + holidays (drives date pushes and auto-scheduling) */}
      <ProductionCalendarForm projectId={project.id} />

      {/* AI assistant: the organization's API key (same key for every production) */}
      {aiSection}

      {/* Union Rules & Labor Compliance Engine */}
      <UnionRulesForm
        initialPreset="SAG_AFTRA"
        initialTurnaround={settings?.min_turnaround_hours || 12}
        initialMaxHours={settings?.max_shooting_hours || 10}
      />

      {/* Danger Zone: Delete Production */}
      <Card className="border-red-900/40 bg-red-950/15">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs font-mono uppercase font-semibold">
            <ShieldAlert className="size-4" /> Danger Zone
          </div>
          <CardTitle className="text-base text-red-700 dark:text-red-300">Delete Production</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Permanently delete this production, its stripboards, call sheets, breakdowns, and cast/crew data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0 pb-4">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setIsDeleteModalOpen(true)}
            className="cursor-pointer text-xs"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Delete Production
          </Button>
        </CardFooter>
      </Card>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteProject}
        title={`Delete "${project.name}"`}
        description="Permanently delete this production, its stripboards, call sheets, breakdowns, and cast/crew data. This action cannot be undone."
        itemName={project.name}
        itemType="production"
        isPending={isDeletePending}
      />
    </div>
  )
}
