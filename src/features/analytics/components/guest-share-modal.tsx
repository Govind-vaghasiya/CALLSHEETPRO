'use client'

import React, { useEffect, useState } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import {
  Share2,
  X,
  Copy,
  Check,
  Shield,
  Clock,
  Key,
  Globe,
  Lock,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createShareableGuestLinkAction, listGuestLinksAction, revokeGuestLinkAction } from '../actions'
import type { GuestAccessScope, ShareableGuestLink } from '../types'

interface GuestShareModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName?: string
}

export function GuestShareModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'Production',
}: GuestShareModalProps) {
  useModalBehavior(isOpen, onClose)
  const [accessScope, setAccessScope] = useState<GuestAccessScope>('VIEW_CALL_SHEETS')
  const [expirationDays, setExpirationDays] = useState<number>(7)
  const [label, setLabel] = useState<string>('')
  const [activeLinks, setActiveLinks] = useState<ShareableGuestLink[]>([])
  const [error, setError] = useState<string | null>(null)

  const refreshLinks = () => listGuestLinksAction(projectId).then(setActiveLinks)
  useEffect(() => {
    if (isOpen) refreshLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId])
  const [generatedLink, setGeneratedLink] = useState<ShareableGuestLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isOpen) return null

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    const res = await createShareableGuestLinkAction(projectId, accessScope, expirationDays, label || undefined)
    if (res.success && res.guestLink) {
      setGeneratedLink(res.guestLink)
      refreshLinks()
    } else {
      setError(res.error || 'Could not create link')
    }
    setIsGenerating(false)
  }

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
              <Share2 className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">Share Guest Access</h3>
              <p className="text-xs text-muted-foreground">Generate secure read-only links for executives & studio heads</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-full size-8 cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-6 space-y-5">
          {/* Access Scope Options */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-subtle-foreground uppercase tracking-wider">
              1. Guest Access Scope
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: 'VIEW_CALL_SHEETS',
                  title: 'Call Sheets Only',
                  desc: 'View & download daily call sheet PDFs',
                },
                {
                  id: 'VIEW_STRIPBOARD',
                  title: 'Stripboard Only',
                  desc: 'View live shooting sequence & days',
                },
                {
                  id: 'FULL_READ_ONLY',
                  title: 'Full Guest Pass',
                  desc: 'Full read-only access to all reports',
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAccessScope(item.id as GuestAccessScope)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    accessScope === item.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-foreground ring-1 ring-indigo-500/50'
                      : 'border-border bg-background/60 text-muted-foreground hover:border-border-strong'
                  }`}
                >
                  <span className="text-xs font-bold text-foreground block mb-1">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground leading-snug block">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Link Expiration & Security */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiration" className="text-xs font-medium text-subtle-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-indigo-700 dark:text-indigo-400" /> Link Expiration
              </Label>
              <select
                id="expiration"
                value={expirationDays}
                onChange={(e) => setExpirationDays(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              >
                <option value={1}>24 Hours (1 Day)</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={30}>30 Days (1 Month)</option>
                <option value={365}>1 Year (Studio Extended)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestLabel" className="text-xs font-medium text-subtle-foreground flex items-center gap-1.5">
                <Lock className="size-3.5 text-amber-700 dark:text-amber-400" /> Who is this for?
              </Label>
              <Input
                id="guestLabel"
                type="text"
                placeholder="e.g. Studio exec — Priya"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="bg-card border-border text-foreground h-9 text-xs"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {/* Link Generation Button or Result */}
          {!generatedLink ? (
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-10 shadow-lg shadow-indigo-600/20 cursor-pointer mt-2"
            >
              {isGenerating ? 'Generating Guest Key...' : 'Create Shareable Link'}
            </Button>
          ) : (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5" /> Guest Access Link Active
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Expires in {expirationDays} days</span>
              </div>

              <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-2">
                <Input
                  readOnly
                  value={generatedLink.url}
                  className="bg-transparent border-none text-xs text-foreground font-mono focus-visible:ring-0 h-8"
                />
                <Button
                  type="button"
                  onClick={handleCopy}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3 shrink-0 cursor-pointer gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-700 dark:text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {activeLinks.length > 0 && (
          <div className="px-6 pb-5 space-y-2">
            <p className="text-xs font-semibold text-subtle-foreground uppercase tracking-wider">Active links</p>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {activeLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 text-xs bg-card border border-border rounded-lg px-3 py-2">
                  <span className="truncate text-foreground">
                    {link.accessScope.replace(/_/g, ' ').toLowerCase()} · {link.visitCount} visits · expires{' '}
                    {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'never'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await revokeGuestLinkAction(projectId, link.id)
                      refreshLinks()
                    }}
                    className="text-red-600 dark:text-red-400 hover:underline shrink-0 cursor-pointer"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-border/80 bg-card/60 text-center text-[10px] text-muted-foreground font-mono">
          Guests receive read-only privileges. No password or Supabase account required.
        </div>
      </div>
    </div>
  )
}
