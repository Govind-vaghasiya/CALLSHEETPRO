'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'
import { createProjectAction, type ProjectActionState } from '@/features/projects/actions'
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
import { Clapperboard, ArrowLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react'

export default function NewProjectPage() {
  const [state, formAction, isPending] = useActionState<ProjectActionState, FormData>(
    createProjectAction,
    {}
  )

  return (
    <div className="flex-1 space-y-8 p-4 sm:p-8 w-full max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Productions
        </Link>
      </div>

      <Card className="border-border bg-card/95 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-1 pb-6 border-b border-border/80">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono tracking-wider uppercase font-semibold">
            <Clapperboard className="size-4" /> Production Setup
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Create New Production
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            Configure your film, television, or commercial project. You can change shooting rules anytime in settings.
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

            {/* Production Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Production Title <span className="text-amber-700 dark:text-amber-400">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="e.g. Inception, Succession Season 5, Apple Holiday Spot"
                required
                autoFocus
                className="bg-background border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                Logline / Description (Optional)
              </Label>
              <textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Brief synopsis or production notes..."
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            </div>

            {/* Type & Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectType" className="text-sm font-medium text-foreground">
                  Production Type
                </Label>
                <select
                  id="projectType"
                  name="projectType"
                  defaultValue="FEATURE"
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="FEATURE">Feature Film</option>
                  <option value="SHORT">Short Film</option>
                  <option value="TV">Television Series / Pilot</option>
                  <option value="COMMERCIAL">Commercial / Promo</option>
                  <option value="MUSIC_VIDEO">Music Video</option>
                  <option value="DOCUMENTARY">Documentary</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium text-foreground">
                  Current Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue="PRE_PRODUCTION"
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="DEVELOPMENT">Development</option>
                  <option value="PRE_PRODUCTION">Pre-Production</option>
                  <option value="PRODUCTION">In Production</option>
                  <option value="POST">Post-Production</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium text-foreground">
                  Estimated Principal Photography Start
                </Label>
                <DatePicker
                  id="startDate"
                  name="startDate"
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
                  placeholder="Pick target wrap date..."
                />
              </div>
            </div>

            {/* Settings Defaults */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
              <div className="space-y-2">
                <Label htmlFor="defaultCallTime" className="text-xs font-medium text-muted-foreground">
                  Standard Crew Call Time
                </Label>
                <Input
                  id="defaultCallTime"
                  name="defaultCallTime"
                  type="time"
                  defaultValue="07:00"
                  className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
                />
                <p className="text-[10px] text-faint">
                  Starting default. Each shoot day, department, and cast member can have custom times.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="text-xs font-medium text-muted-foreground">
                  Currency
                </Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue="USD"
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-xs font-medium text-muted-foreground">
                  Production Timezone
                </Label>
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue="America/Los_Angeles"
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <option value="America/Los_Angeles">Pacific Time (US/Canada)</option>
                  <option value="America/New_York">Eastern Time (US/Canada)</option>
                  <option value="America/Chicago">Central Time (US/Canada)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/80 pt-6 pb-6">
            <Link href="/projects">
              <Button type="button" variant="outline" className="border-border text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6 shadow-xl shadow-amber-500/15 transition-all cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Creating Workspace...
                </>
              ) : (
                <>
                  Create Production Workspace
                  <ArrowRight className="size-4 ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
