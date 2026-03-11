// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // request.cookies é read-only no Next.js — NÃO usar request.cookies.set()
            // Apenas atualizar o response é suficiente para propagar o cookie
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Renova o token e atualiza o cookie a cada request (necessário para SSR).
  // Redirecionamentos ficam no AuthProvider (client-side) para evitar
  // conflito com a navegação do browser após o login.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|manifest\\.json|sw\\.js|workbox-.*|icons/).*)',
  ],
}