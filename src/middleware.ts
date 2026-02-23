// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  // Excluir explicitamente arquivos PWA do middleware
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|manifest\\.json|sw\\.js|workbox-.*|icons/).*)',
  ],
}