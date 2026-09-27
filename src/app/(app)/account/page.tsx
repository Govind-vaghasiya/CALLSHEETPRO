import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountSettings } from '@/features/auth/components/account-settings'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/account')

  const { data: profile } = await supabase.from('user_profiles').select('full_name, timezone').eq('id', user.id).maybeSingle()

  return (
    <AccountSettings
      email={user.email || ''}
      pendingEmail={user.new_email || null}
      fullName={profile?.full_name || (user.user_metadata?.full_name as string | undefined) || ''}
      timezone={profile?.timezone || 'UTC'}
    />
  )
}
