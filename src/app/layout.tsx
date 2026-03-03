// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/shared/AuthProvider'

export const metadata: Metadata = {
  title: 'Hoffmann | Clínica Odontológica e Estética',
  description: 'Sistema de gestão clínica',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hoffmann',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F0F0F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}