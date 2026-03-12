// src/app/(app)/layout.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Users, History, Scan, DollarSign, Settings } from 'lucide-react'

const NAV = [
  { href: '/pacientes',    icon: Users,      label: 'Pacientes'  },
  { href: '/historico',    icon: History,    label: 'Histórico'  },
  { href: '/radiografias', icon: Scan,       label: 'Raio-X'     },
  { href: '/financeiro',   icon: DollarSign, label: 'Financeiro' },
  { href: '/configuracoes', icon: Settings,  label: 'Config.'    },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const activeRoute = NAV.find(n =>
    pathname === n.href || pathname.startsWith(n.href + '/')
  )?.href

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--hf-cream)' }}>

      {/* ── Top bar ── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: 'var(--hf-white)', borderColor: 'var(--hf-gray-200)' }}
      >
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
          <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--hf-black)', margin: 0, lineHeight: 1 }}>HOFFMANN</p>
          <p style={{ fontSize: 8, letterSpacing: '0.2em', color: 'var(--hf-gray-400)', margin: 0, marginTop: 2, fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>CLÍNICA ODONTOLÓGICA E ESTÉTICA</p>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* ── Navbar inferior ── */}
      <nav
        className="flex-shrink-0 border-t"
        style={{
          background: 'var(--hf-white)',
          borderColor: 'var(--hf-gray-200)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = activeRoute === href
            return (
              <Link key={href} href={href}
                className="flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors"
                style={{ color: active ? 'var(--hf-gold)' : 'var(--hf-gray-400)' }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] tracking-wide"
                  style={{ fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: 'var(--hf-gold)' }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
