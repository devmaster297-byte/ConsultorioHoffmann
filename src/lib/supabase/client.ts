// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

// Singleton seguro para uso exclusivo no browser (client components)
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Garantir que só é executado no browser
  if (typeof window === 'undefined') {
    // Em contexto de servidor, criar instância temporária sem cache
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (_client) return _client

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: window.localStorage,
        storageKey: 'hoffmann-supabase-session',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  )

  return _client
}

// Limpar o singleton no logout para evitar dados residuais entre sessões
export function resetClient() {
  _client = null
}