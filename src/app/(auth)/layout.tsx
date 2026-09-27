import React from 'react'
import Link from 'next/link'
import { Clapperboard } from 'lucide-react'
import { ThemeToggleButton } from '@/components/theme/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-800 dark:selection:text-amber-200 relative overflow-hidden">
      {/* Ambient cinema glow backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-blue-500/5 blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 py-6 sm:px-10 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="size-10 rounded-lg bg-card border border-border-strong/60 flex items-center justify-center shadow-lg group-hover:border-amber-500/50 transition-colors">
            <Clapperboard className="size-5 text-amber-700 dark:text-amber-400 group-hover:rotate-6 transition-transform" />
          </div>
          <div>
            <span className="font-bold tracking-wider text-base text-foreground font-mono">
              CALLSHEET<span className="text-amber-700 dark:text-amber-400">PRO</span>
            </span>
            <span className="hidden sm:block text-[10px] text-muted-foreground uppercase tracking-widest -mt-1 font-medium">
              Precision Film Scheduling
            </span>
          </div>
        </Link>
        <ThemeToggleButton />
      </header>

      {/* Main Form Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground font-mono border-t border-border/40 z-10">
        CallSheetPro © {new Date().getFullYear()} · Multi-Tenant Production Engine · iPad & Desktop Ready
      </footer>
    </div>
  )
}
