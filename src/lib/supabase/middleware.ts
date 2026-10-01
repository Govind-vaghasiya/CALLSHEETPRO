import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session (required for Server Components)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const url = new URL(path, request.url) // path may carry its own ?query
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const response = NextResponse.redirect(url)
    // keep any refreshed auth cookies
    supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
    return response
  }

  // Auth email links can land on any page (e.g. the Site URL when the redirect address isn't on
  // Supabase's allow-list). Hand them to /auth/confirm so the code is exchanged, not ignored.
  const sp = request.nextUrl.searchParams
  const carriesAuth = sp.has('code') || sp.has('token_hash') || (sp.has('error') && sp.has('error_code'))
  if (carriesAuth && !pathname.startsWith('/auth/')) {
    const url = new URL('/auth/confirm', request.url)
    sp.forEach((v, k) => url.searchParams.set(k, v))
    if (!url.searchParams.has('next') && pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Everything inside the app needs a signed-in user
  const PROTECTED = ['/dashboard', '/projects', '/resources', '/schedule', '/callsheets', '/breakdown', '/org', '/account']
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (isProtected && !user) {
    return redirectTo('/login', { redirectTo: `${pathname}${search}` })
  }

  // Setting a new password needs the session created by the reset link
  if (pathname.startsWith('/reset-password') && !user) {
    return redirectTo('/forgot-password', {
      error: 'Your reset link has expired or was already used. Please request a new one.',
    })
  }

  // Signed-in users don't need the sign-in pages (but /reset-password must stay reachable)
  const isSignInPage =
    pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password')
  if (isSignInPage && user) {
    const target = request.nextUrl.searchParams.get('redirectTo')
    return redirectTo(target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard')
  }

  return supabaseResponse
}
