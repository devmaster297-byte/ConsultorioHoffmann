// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'

const ROTAS_PUBLICAS = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  // Começa false — sem splash, sem delay artificial.
  // A tela de loading só aparece enquanto carregando=true.
  const [carregando, setCarregando] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true

    let montado = true

    // Timeout de segurança: se em 5s nada resolver, libera a tela
    const timeout = setTimeout(() => {
      if (montado && carregando) {
        console.warn('AuthProvider: timeout — liberando tela')
        setCarregando(false)
      }
    }, 5000)

    async function resolver(userId: string, email?: string | null) {
      try {
        const { data: usuarioDB } = await supabase
          .from('usuarios')
          .select('id, nome, clinica_id, perfil, ativo, created_at')
          .eq('id', userId)
          .single()

        if (!montado) return

        if (usuarioDB) {
          setUsuario(usuarioDB, email ?? undefined)
        } else {
          setUsuario(null)
          await supabase.auth.signOut()
        }
      } catch {
        if (montado) setUsuario(null)
      } finally {
        clearTimeout(timeout)
        if (montado) setCarregando(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!montado) return

      if (event === 'INITIAL_SESSION') {
        if (!session?.user) {
          clearTimeout(timeout)
          setUsuario(null)
          setCarregando(false)
          return
        }
        // Já temos dados do mesmo usuário no store
        if (usuario?.id === session.user.id && usuario?.clinica_id) {
          clearTimeout(timeout)
          setCarregando(false)
          return
        }
        resolver(session.user.id, session.user.email)
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setCarregando(true)
        resolver(session.user.id, session.user.email)
        return
      }

      if (event === 'SIGNED_OUT') {
        clearTimeout(timeout)
        setUsuario(null)
        setCarregando(false)
        router.replace('/login')
        return
      }
    })

    return () => {
      montado = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guard de rota
  useEffect(() => {
    if (carregando) return
    const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))
    if (!usuario && !rotaPublica) router.replace('/login')
    if (usuario && pathname === '/login') router.replace('/pacientes')
  }, [pathname, usuario, carregando, router])

  if (carregando) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: 'var(--hf-black)' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 500, letterSpacing: '0.2em', color: '#FFFFFF', margin: 0 }}>HOFFMANN</p>
          <p style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--hf-gold)', marginTop: 4, fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>
            CLÍNICA ODONTOLÓGICA E ESTÉTICA
          </p>
        </div>
        <div className="absolute bottom-14 flex gap-2">
          {[0, 0.2, 0.4].map((d, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
              style={{ background: 'var(--hf-gold)', animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return <>{children}</>
}