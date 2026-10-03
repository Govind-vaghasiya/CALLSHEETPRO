'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, KeyRound, Lock, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useFeedback } from '@/components/ui/feedback-provider'
import { removeOrgAiKeyAction, saveOrgAiKeyAction, type OrgAiSettings } from '../ai-settings-actions'

/**
 * The organization's AI key: status, save/replace (checked with Anthropic first) and remove.
 * Shown in Organization settings and in each production's Settings tab — both edit the same
 * organization-wide key.
 */
export function AiKeySection({ orgId, orgName, ai }: { orgId: string; orgName: string; ai: OrgAiSettings }) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const key = String(new FormData(e.currentTarget).get('apiKey') || '')
    if (!key.trim()) return
    setSaving(true)
    setError(null)
    const res = await saveOrgAiKeyAction(orgId, key)
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    formRef.current?.reset()
    notify('AI key checked and saved. AI features are ready for every production in this organization.', 'success')
    router.refresh()
  }

  const handleRemove = async () => {
    const ok = await confirm({
      title: 'Remove the AI key?',
      message: 'AI features (like drafting one-liners) stop working for every production in this organization until a new key is added.',
      confirmLabel: 'Remove key',
      destructive: true,
    })
    if (!ok) return
    setRemoving(true)
    const res = await removeOrgAiKeyAction(orgId)
    setRemoving(false)
    if (res.error) notify(res.error, 'error')
    else {
      notify('AI key removed.', 'success')
      router.refresh()
    }
  }

  const updated = ai.updatedAt
    ? new Date(ai.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 grid gap-5 md:grid-cols-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-amber-600 dark:text-amber-400" /> AI assistant
        </h2>
        <p className="text-sm text-muted-foreground">
          Powers AI features such as drafting scene one-liners. Set it once — every production in {orgName} uses it.
        </p>
      </div>

      <div className="md:col-span-2 space-y-4">
        {ai.needsMigration && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            This needs a one-time database update: run supabase/migrations/024_org_ai_key.sql in the Supabase SQL Editor.
          </p>
        )}

        {/* Current status */}
        <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
          {ai.configured ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Anthropic key saved
                  <span className="font-mono text-xs text-muted-foreground">sk-ant-…{ai.keyHint}</span>
                </p>
                {(updated || ai.updatedByName) && (
                  <p className="text-xs text-muted-foreground">
                    Set {ai.updatedByName ? `by ${ai.updatedByName} ` : ''}
                    {updated ? `on ${updated}` : ''}
                  </p>
                )}
              </div>
              {ai.canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  {removing ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </div>
          ) : ai.usingServerKey ? (
            <p className="text-muted-foreground">
              No organization key yet. AI is using the server&apos;s <span className="font-mono">ANTHROPIC_API_KEY</span> for now.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              Not set up — AI features are off.
            </p>
          )}
        </div>

        {ai.canEdit ? (
          <form ref={formRef} onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">{ai.configured ? 'Replace with a new key' : 'Anthropic API key'}</Label>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
                className="h-10 bg-background font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Create one at{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  console.anthropic.com
                </a>
                . Usage is billed to that Anthropic account.
              </p>
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="size-4 mt-0.5 shrink-0" /> {error}
              </p>
            )}
            <Button type="submit" disabled={saving || ai.needsMigration} className="cursor-pointer">
              <KeyRound className="size-4 mr-1.5" />
              {saving ? 'Checking key…' : ai.configured ? 'Check & replace key' : 'Check & save key'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Only organization owners and admins can change the AI key.</p>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 mt-0.5 shrink-0" />
          The key is encrypted in the database (Supabase Vault). It is never shown again or sent to anyone&apos;s browser —
          only the last 4 characters are kept for reference. The server decrypts it only to make AI requests.
        </p>
      </div>
    </section>
  )
}

export function OrgSettings({
  orgId,
  orgName,
  role,
  ai,
}: {
  orgId: string
  orgName: string
  role: string
  ai: OrgAiSettings
}) {
  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Organization settings</h1>
        <p className="text-sm text-muted-foreground">
          {orgName} · you are <span className="font-mono text-amber-700 dark:text-amber-400">{role}</span>
        </p>
      </div>

      <AiKeySection orgId={orgId} orgName={orgName} ai={ai} />
    </div>
  )
}
