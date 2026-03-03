// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

const ROTAS_PUBLICAS = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const [splash, setSplash] = useState(true)
  const pathname = usePathname()

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

  // ── Splash / loading ───────────────────────────────────────────────────────
  if (splash || carregando) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'var(--hf-black)' }}
      >
        <div className="animate-fade-in-up flex flex-col items-center">
          <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', textAlign: 'center' }}>
            <p style={{ fontSize: 32, fontWeight: 500, letterSpacing: '0.2em', color: '#FFFFFF', margin: 0 }}>HOFFMANN</p>
            <p style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--hf-gold)', marginTop: 4, fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>CLÍNICA ODONTOLÓGICA E ESTÉTICA</p>
          </div>
          <p className="mt-3 text-xs tracking-[0.25em] uppercase"
            style={{ color: 'var(--hf-gold)', fontWeight: 300 }}>
            Clínica Odontológica e Estética
          </p>
        </div>

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