'use client'

/**
 * The project name in the project header, plus an optional suffix a page can add
 * (the script page shows "Project — script.pdf").
 */
import React, { createContext, useContext, useEffect, useState } from 'react'

const SuffixContext = createContext<{
  suffix: string | null
  setSuffix: (suffix: string | null) => void
} | null>(null)

export function ProjectTitleProvider({ children }: { children: React.ReactNode }) {
  const [suffix, setSuffix] = useState<string | null>(null)
  return <SuffixContext.Provider value={{ suffix, setSuffix }}>{children}</SuffixContext.Provider>
}

export function ProjectTitle({ name }: { name: string }) {
  const suffix = useContext(SuffixContext)?.suffix
  return (
    <h1 className="text-2xl font-bold tracking-tight text-foreground">
      {name}
      {suffix && <span className="font-semibold text-muted-foreground"> - {suffix}</span>}
    </h1>
  )
}

/** Shows `suffix` after the project name while the calling page is mounted. */
export function useProjectTitleSuffix(suffix: string | null) {
  const setSuffix = useContext(SuffixContext)?.setSuffix
  useEffect(() => {
    if (!setSuffix) return
    setSuffix(suffix)
    return () => setSuffix(null)
  }, [setSuffix, suffix])
}
