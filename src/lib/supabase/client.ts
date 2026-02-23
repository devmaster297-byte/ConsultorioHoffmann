// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'dentesoft-supabase-session',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined
          const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
            const eqIdx = cookie.indexOf('=')
            if (eqIdx > 0) {
              const key = cookie.slice(0, eqIdx)
              const value = cookie.slice(eqIdx + 1)
              acc[key] = value
            }
            return acc
          }, {} as Record<string, string>)
          return cookies[name]
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(name: string, value: string, options: any) {
          if (typeof document === 'undefined') return
          let cookie = `${name}=${value}; path=/`
          if (options?.maxAge)   cookie += `; max-age=${options.maxAge}`
          if (options?.domain)   cookie += `; domain=${options.domain}`
          if (options?.secure)   cookie += `; secure`
          if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
          document.cookie = cookie
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remove(name: string, _options: any) {
          if (typeof document === 'undefined') return
          document.cookie = `${name}=; max-age=0; path=/`
        },
      },
    }
  )

  return client
}