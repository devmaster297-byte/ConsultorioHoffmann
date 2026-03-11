// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

const ROTAS_PUBLICAS = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const [splash, setSplash] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  // Splash de entrada (reduzido para 800ms — 1600ms parecia travado)
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 800)
    return () => clearTimeout(t)
  }, [])

  // Inicialização da sessão — roda UMA vez no mount
  useEffect(() => {
    const supabase = createClient()
    let montado = true

    async function init() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (!montado) return

        if (error || !user) {
          setUsuario(null)
          setCarregando(false)
          return
        }

        // Evitar re-fetch se já temos os dados do mesmo usuário
        if (usuario?.id === user.id && usuario?.clinica_id) {
          setCarregando(false)
          return
        }

        const { data: usuarioDB } = await supabase
          .from('usuarios')
          .select('id, nome, clinica_id, perfil, ativo, created_at')
          .eq('id', user.id)
          .single()

        if (!montado) return

        if (usuarioDB) {
          setUsuario(usuarioDB, user.email)
        } else {
          // Autenticado no Supabase Auth mas sem registro em 'usuarios'
          setUsuario(null)
          await supabase.auth.signOut()
        }
      } catch (e) {
        console.error('AuthProvider erro:', e)
        if (montado) setUsuario(null)
      } finally {
        if (montado) setCarregando(false)
      }
    }

    init()

    // Listener de mudanças de sessão (logout, expiração, login em outra aba)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!montado) return

      if (event === 'SIGNED_OUT' || !session) {
        setUsuario(null)
        router.replace('/login')
        return
      }

      if (event === 'SIGNED_IN') {
        // Buscar dados do usuário e navegar para o app
        const { data: usuarioDB } = await supabase
          .from('usuarios')
          .select('id, nome, clinica_id, perfil, ativo, created_at')
          .eq('id', session.user.id)
          .single()

        if (!montado) return

        if (usuarioDB) {
          setUsuario(usuarioDB, session.user.email)
          // Só redireciona se estiver em rota pública (ex: /login)
          const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))
          if (rotaPublica) {
            router.replace('/pacientes')
          }
        }
        return
      }

      if (event === 'TOKEN_REFRESHED' && session.user) {
        // Token renovado — apenas atualizar store se for usuário diferente
        if (usuario?.id !== session.user.id) {
          const { data: usuarioDB } = await supabase
            .from('usuarios')
            .select('id, nome, clinica_id, perfil, ativo, created_at')
            .eq('id', session.user.id)
            .single()

          if (montado && usuarioDB) {
            setUsuario(usuarioDB, session.user.email)
          }
        }
      }
    })

    return () => {
      montado = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirecionamento baseado em pathname — roda quando a rota muda
  useEffect(() => {
    if (carregando) return

    const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))

    if (!usuario && !rotaPublica) {
      router.replace('/login')
    }
  }, [pathname, usuario, carregando, router])

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