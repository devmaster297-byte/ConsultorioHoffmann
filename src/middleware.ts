// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Middleware simples — sem verificação de auth
  // A proteção de rotas é feita pelo AuthProvider no client
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|workbox-.*\\.js|manifest\\.json|icons/).*)',
  ],
}