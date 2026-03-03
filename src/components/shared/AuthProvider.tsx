// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

const ROTAS_PUBLICAS = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const [splash, setSplash] = useState(true)
  const pathname = usePathname()

  // Splash screen de 1.6s apenas no carregamento inicial
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          if (usuario?.id === session.user.id && usuario?.clinica_id) {
            setCarregando(false)
            return
          }

          const { data: usuarioDB } = await supabase
            .from('usuarios')
            .select('id, nome, clinica_id, perfil, ativo, created_at')
            .eq('id', session.user.id)
            .single()

          if (usuarioDB) {
            setUsuario(usuarioDB, session.user.email)
          }
          setCarregando(false)
        } else {
          setUsuario(null)
          setCarregando(false)
          const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))
          if (!rotaPublica) {
            window.location.href = '/login'
          }
        }
      } catch (e) {
        console.error('AuthProvider erro:', e)
        setCarregando(false)
      }
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Splash screen ──────────────────────────────────────────────────────────
  if (splash || carregando) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'var(--hf-black)' }}
      >
        <div className="animate-fade-in-up flex flex-col items-center">
          <Image
            src="/logo-hoffmann.png"
            alt="Hoffmann"
            width={180}
            height={72}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            priority
          />
          <p className="mt-3 text-xs tracking-[0.25em] uppercase"
            style={{ color: 'var(--hf-gold)', fontWeight: 300 }}>
            Clínica Odontológica e Estética
          </p>
        </div>

        {/* Dots pulsando */}
        <div className="absolute bottom-14 flex gap-2">
          {[0, 0.2, 0.4].map((d, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
              style={{ background: 'var(--hf-gold)', animationDelay: `${d}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return <>{children}</>
}