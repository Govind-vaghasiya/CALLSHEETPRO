'use client'

import { useActionState } from 'react'
import { createOrganizationAction, type OrgActionState } from '@/features/organizations/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Clapperboard, Building2, AlertCircle, ArrowRight, Loader2, Check } from 'lucide-react'

export default function NewOrganizationPage() {
  const [state, formAction, isPending] = useActionState<OrgActionState, FormData>(
    createOrganizationAction,
    {}
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background illumination */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl">
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex size-14 rounded-2xl bg-card border border-border-strong/80 items-center justify-center shadow-xl mb-2">
            <Clapperboard className="size-7 text-amber-700 dark:text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome to CallSheetPro
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
            Set up your studio or production company workspace to start creating projects and schedules.
          </p>
        </div>

        <Card className="border-border bg-card/95 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-6 border-b border-border/60">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono tracking-wider uppercase font-semibold">
              <Building2 className="size-4" /> Studio Setup
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              Name your Production Company
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              This will be your shared multi-tenant space where you can manage multiple feature films, series, or commercials.
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

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  Company / Studio Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Paramount Pictures, Horizon Studios, Nolan Films"
                  required
                  autoFocus
                  className="bg-background border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  You can invite producers, 1st ADs, and department heads after setup.
                </p>
              </div>

              {/* Workspace Benefits */}
              <div className="rounded-lg bg-background/60 border border-border/80 p-4 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Your Studio Workspace Includes:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-subtle-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>SAG-AFTRA & IATSE Rules Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>Multi-Project Stripboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>Instant Call Sheet Generation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>Conflict & Overtime Detection</span>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-base tracking-wide shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin mr-2" />
                    Creating Workspace...
                  </>
                ) : (
                  <>
                    Launch Production Workspace
                    <ArrowRight className="size-5 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
