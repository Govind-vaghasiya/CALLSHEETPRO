import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ThemeToggleButton } from '@/components/theme/theme-toggle'
import {
  Clapperboard,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock
} from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-800 dark:selection:text-amber-200 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent blur-[140px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="px-6 py-6 sm:px-12 flex items-center justify-between z-10 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-card border border-border-strong/80 flex items-center justify-center shadow-lg">
            <Clapperboard className="size-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <span className="font-bold tracking-wider text-base text-foreground font-mono">
              CALLSHEET<span className="text-amber-700 dark:text-amber-400">PRO</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggleButton />
          <Link href="/login">
            <Button
              variant="outline"
              className="border-border text-foreground hover:text-foreground hover:bg-card cursor-pointer h-9 px-4 text-xs font-medium"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/15 cursor-pointer h-9 px-4 text-xs">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 z-10 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-700 dark:text-amber-300 mb-6">
          <Sparkles className="size-3.5" />
          <span>Next-Generation Film Production Scheduling</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl leading-[1.1]">
          Precision Scheduling for Modern Film & TV Productions
        </h1>

        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          The only production platform built with a deterministic rules engine. Enforce SAG-AFTRA turnaround, prevent double-bookings, automate stripboards, and generate industry-standard call sheets in seconds.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/signup">
            <Button className="h-12 px-8 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-base shadow-xl shadow-amber-500/20 transition-all cursor-pointer">
              Launch Production Workspace
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              className="h-12 px-6 border-border bg-card/60 hover:bg-card text-subtle-foreground hover:text-foreground cursor-pointer"
            >
              Sign In to Existing Project
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
          <div className="p-6 rounded-xl bg-card/40 border border-border/80 backdrop-blur-sm space-y-3">
            <div className="size-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Deterministic Rules Engine
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time validation against SAG-AFTRA, IATSE, and DGA turnaround rules, overtime limits, and consecutive day constraints.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card/40 border border-border/80 backdrop-blur-sm space-y-3">
            <div className="size-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Calendar className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Dynamic Stripboard & DOOD
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drag-and-drop scene scheduling with automatic Day-Out-of-Days reports and travel time calculations between locations.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card/40 border border-border/80 backdrop-blur-sm space-y-3">
            <div className="size-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              One-Click Call Sheets
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Direct generation of standardized call sheets populated with scene calls, nearest hospital, weather, and department notes.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground font-mono border-t border-border/60 z-10">
        CallSheetPro © {new Date().getFullYear()} · Multi-Tenant Production Scheduling · Designed for iPad & Desktop
      </footer>
    </div>
  )
}
