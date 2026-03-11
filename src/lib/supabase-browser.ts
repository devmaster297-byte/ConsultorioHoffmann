// src/lib/supabase-browser.ts
// ÚNICA instância do cliente Supabase para uso em client components, hooks e stores.
// Importe SEMPRE desta forma:
//   import { supabase } from '@/lib/supabase-browser'
// NUNCA crie uma nova instância com createBrowserClient() dentro de componentes.

import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
