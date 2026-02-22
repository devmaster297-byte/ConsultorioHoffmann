import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Lê o cookie manualmente
          const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
            const [key, value] = cookie.split('=')
            acc[key] = value
            return acc
          }, {} as Record<string, string>)
          return cookies[name]
        },
        set(name: string, value: string, options: any) {
          // Define o cookie com path='/'
          let cookie = `${name}=${value}; path=/`
          if (options.maxAge) cookie += `; max-age=${options.maxAge}`
          if (options.domain) cookie += `; domain=${options.domain}`
          if (options.secure) cookie += `; secure`
          if (options.sameSite) cookie += `; samesite=${options.sameSite}`
          document.cookie = cookie
        },
        remove(name: string, options: any) {
          document.cookie = `${name}=; max-age=0; path=/`
        },
      },
    }
  )
}