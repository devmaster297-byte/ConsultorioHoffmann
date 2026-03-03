// src/app/(app)/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Users, History, Scan, DollarSign } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/pacientes',  icon: Users,      label: 'Pacientes'  },
  { href: '/historico',  icon: History,    label: 'Histórico'  },
  { href: '/radiografias', icon: Scan,     label: 'Raio-X'     },
  { href: '/financeiro', icon: DollarSign, label: 'Financeiro' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname()
  const router     = useRouter()
  const { setUsuario } = useAuthStore()
  const [pronto, setPronto] = useState(false)
  const [splash, setSplash] = useState(true)

  useEffect(() => {
    // Splash de 1.8s na abertura
    const t = setTimeout(() => setSplash(false), 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nome, clinica_id, perfil')
        .eq('id', session.user.id)
        .single()

      if (!usuario) { router.replace('/login'); return }

      setUsuario(usuario)
      
      setPronto(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setUsuario(null); router.replace('/login') }
    })
    return () => subscription.unsubscribe()
  }, [router, setUsuario])

  // ── Splash screen ──────────────────────────────────────────────────────────
  if (splash) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'var(--hf-black)' }}>
        <div style={{ animation: 'fadeInUp 0.8s ease forwards', opacity: 0 }}>
          <Image
            src="/logo-hoffmann.png"
            alt="Hoffmann"
            width={180}
            height={72}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <p className="text-center mt-3 text-xs tracking-[0.25em] uppercase"
            style={{ color: 'var(--hf-gold)', fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>
            Clínica Odontológica e Estética
          </p>
        </div>
        <div className="absolute bottom-12 flex gap-1">
          {[0, 0.2, 0.4].map((d, i) => (
            <div key={i} className="h-1 w-1 rounded-full"
              style={{
                background: 'var(--hf-gold)',
                animation: `pulse 1.2s ease-in-out ${d}s infinite`,
              }} />
          ))}
        </div>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50%       { opacity: 1;   transform: scale(1.2); }
          }
        `}</style>
      </div>
    )
  }

  if (!pronto) {
    return (
      <div className="fixed inset-0 flex items-center justify-center"
        style={{ background: 'var(--hf-cream)' }}>
        <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--hf-gold)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const activeRoute = NAV.find(n =>
    pathname === n.href || pathname.startsWith(n.href + '/')
  )?.href

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--hf-cream)' }}>
      {/* ── Top bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: 'var(--hf-white)', borderColor: 'var(--hf-gray-200)' }}>
        <Image
          src="/logo-hoffmann.png"
          alt="Hoffmann"
          width={110}
          height={44}
          className="object-contain"
        />
        <p className="text-xs tracking-[0.15em] uppercase"
          style={{ color: 'var(--hf-gray-400)', fontWeight: 300 }}>
          Sistema Clínico
        </p>
      </header>

      {/* ── Conteúdo ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* ── Navbar ── */}
      <nav className="flex-shrink-0 border-t"
        style={{
          background: 'var(--hf-white)',
          borderColor: 'var(--hf-gray-200)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        <div className="flex">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = activeRoute === href
            return (
              <Link key={href} href={href}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
                style={{ color: active ? 'var(--hf-gold)' : 'var(--hf-gray-400)' }}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] tracking-wide"
                  style={{
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--hf-gold)' : 'var(--hf-gray-400)',
                  }}>
                  {label}
                </span>
                {active && (
                  <div className="absolute bottom-0 h-0.5 w-8 rounded-full"
                    style={{ background: 'var(--hf-gold)' }} />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}