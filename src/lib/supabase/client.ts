// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

// Singleton seguro para uso exclusivo no browser (client components)
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Em contexto de servidor (SSR), nunca usar singleton
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (_client) return _client

  // Deixar o @supabase/ssr gerenciar storage, locks e refresh por conta própria.
  // NÃO passar storageKey customizado — ele causa conflito no Web Locks API
  // (Navigator.locks) quando múltiplas abas ou re-renders tentam adquirir
  // o mesmo lock simultaneamente, resultando em timeout de 10s.
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return _client
}

// Limpar o singleton no logout para evitar dados residuais entre sessões
export function resetClient() {
  _client = null
}