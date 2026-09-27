import type { RevisionColor } from '@/types/database'

export interface RevisionColorMeta {
  color: RevisionColor
  label: string
  pillBg: string
  pillBorder: string
  pillText: string
  dotBg: string
  desc: string
}

export const REVISION_COLORS: Record<RevisionColor, RevisionColorMeta> = {
  WHITE: {
    color: 'WHITE',
    label: 'White (Production)',
    pillBg: 'bg-zinc-100/10',
    pillBorder: 'border-zinc-300/40',
    pillText: 'text-zinc-100',
    dotBg: 'bg-zinc-100',
    desc: 'Standard First Draft',
  },
  BLUE: {
    color: 'BLUE',
    label: 'Blue (1st Rev)',
    pillBg: 'bg-sky-500/15',
    pillBorder: 'border-sky-500/40',
    pillText: 'text-sky-300',
    dotBg: 'bg-sky-400',
    desc: '1st Revision Draft',
  },
  PINK: {
    color: 'PINK',
    label: 'Pink (2nd Rev)',
    pillBg: 'bg-pink-500/15',
    pillBorder: 'border-pink-500/40',
    pillText: 'text-pink-300',
    dotBg: 'bg-pink-400',
    desc: '2nd Revision Draft',
  },
  YELLOW: {
    color: 'YELLOW',
    label: 'Yellow (3rd Rev)',
    pillBg: 'bg-amber-500/15',
    pillBorder: 'border-amber-500/40',
    pillText: 'text-amber-300',
    dotBg: 'bg-amber-400',
    desc: '3rd Revision Draft',
  },
  GREEN: {
    color: 'GREEN',
    label: 'Green (4th Rev)',
    pillBg: 'bg-emerald-500/15',
    pillBorder: 'border-emerald-500/40',
    pillText: 'text-emerald-300',
    dotBg: 'bg-emerald-400',
    desc: '4th Revision Draft',
  },
  GOLDENROD: {
    color: 'GOLDENROD',
    label: 'Goldenrod (5th Rev)',
    pillBg: 'bg-yellow-600/15',
    pillBorder: 'border-yellow-500/40',
    pillText: 'text-yellow-300',
    dotBg: 'bg-yellow-500',
    desc: '5th Revision Draft',
  },
  BUFF: {
    color: 'BUFF',
    label: 'Buff (6th Rev)',
    pillBg: 'bg-stone-500/20',
    pillBorder: 'border-stone-400/40',
    pillText: 'text-stone-300',
    dotBg: 'bg-stone-300',
    desc: '6th Revision Draft',
  },
  SALMON: {
    color: 'SALMON',
    label: 'Salmon (7th Rev)',
    pillBg: 'bg-rose-500/15',
    pillBorder: 'border-rose-500/40',
    pillText: 'text-rose-300',
    dotBg: 'bg-rose-400',
    desc: '7th Revision Draft',
  },
  CHERRY: {
    color: 'CHERRY',
    label: 'Cherry (8th Rev)',
    pillBg: 'bg-red-600/15',
    pillBorder: 'border-red-500/40',
    pillText: 'text-red-300',
    dotBg: 'bg-red-500',
    desc: '8th Revision Draft',
  },
  TAN: {
    color: 'TAN',
    label: 'Tan (9th Rev)',
    pillBg: 'bg-amber-800/20',
    pillBorder: 'border-amber-700/40',
    pillText: 'text-amber-200',
    dotBg: 'bg-amber-600',
    desc: '9th Revision Draft',
  },
  DOUBLE_WHITE: {
    color: 'DOUBLE_WHITE',
    label: '2nd White (10th Rev)',
    pillBg: 'bg-zinc-200/15',
    pillBorder: 'border-zinc-200/50',
    pillText: 'text-zinc-100',
    dotBg: 'bg-white',
    desc: 'Full cycle complete',
  },
  CUSTOM: {
    color: 'CUSTOM',
    label: 'Custom Revision',
    pillBg: 'bg-purple-500/15',
    pillBorder: 'border-purple-500/40',
    pillText: 'text-purple-300',
    dotBg: 'bg-purple-400',
    desc: 'Special edition draft',
  },
}

export const REVISION_COLORS_ORDERED: RevisionColor[] = [
  'WHITE',
  'BLUE',
  'PINK',
  'YELLOW',
  'GREEN',
  'GOLDENROD',
  'BUFF',
  'SALMON',
  'CHERRY',
  'DOUBLE_WHITE',
  'CUSTOM',
]

export function getRevisionColorMeta(color: RevisionColor): RevisionColorMeta {
  return REVISION_COLORS[color] || REVISION_COLORS.WHITE
}

export function formatScriptBadge(version: number, color: RevisionColor): string {
  const meta = getRevisionColorMeta(color)
  return `v${version} · ${meta.label.split(' ')[0]}`
}
