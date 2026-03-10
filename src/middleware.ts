// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const ROTAS_PUBLICAS = ['/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  // Criar cliente Supabase com cookies do request/response
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
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // SEMPRE usar getUser() — valida o token no servidor (getSession() é inseguro)
  const { data: { user } } = await supabase.auth.getUser()

  const ehRotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))

  // Usuário não autenticado tentando acessar rota protegida → redirecionar para login
  if (!user && !ehRotaPublica) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Usuário já autenticado tentando acessar login → redirecionar para app
  if (user && ehRotaPublica) {
    return NextResponse.redirect(new URL('/pacientes', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|manifest\\.json|sw\\.js|workbox-.*|icons/).*)',
  ],
}