// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'

const ROTAS_PUBLICAS = ['/login']

async function buscarUsuarioDB(userId: string, email?: string | null) {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, clinica_id, perfil, ativo, created_at')
    .eq('id', userId)
    .single()
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const [splash, setSplash] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const iniciado = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true

    let montado = true

    // Usar onAuthStateChange como fonte única de verdade.
    // NÃO chamar getUser() aqui — ele compete pelo Web Lock com autoRefreshToken
    // e causa timeout de 10s. O evento INITIAL_SESSION dispara automaticamente
    // com a sessão atual (ou null) sem adquirir nenhum lock extra.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!montado) return

      // INITIAL_SESSION: dispara imediatamente no mount com a sessão do storage
      if (event === 'INITIAL_SESSION') {
        if (!session?.user) {
          setUsuario(null)
          setCarregando(false)
          return
        }

        // Já temos dados do mesmo usuário — não refazer o fetch
        if (usuario?.id === session.user.id && usuario?.clinica_id) {
          setCarregando(false)
          return
        }

        const usuarioDB = await buscarUsuarioDB(session.user.id)
        if (!montado) return

        if (usuarioDB) {
          setUsuario(usuarioDB, session.user.email ?? undefined)
        } else {
          setUsuario(null)
          await supabase.auth.signOut()
        }
        setCarregando(false)
        return
      }

      if (event === 'SIGNED_IN') {
        setCarregando(true)
        const usuarioDB = await buscarUsuarioDB(session!.user.id)
        if (!montado) return

        if (usuarioDB) {
          setUsuario(usuarioDB, session!.user.email ?? undefined)
          const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))
          if (rotaPublica) router.replace('/pacientes')
        } else {
          setUsuario(null)
          await supabase.auth.signOut()
        }
        setCarregando(false)
        return
      }

      if (event === 'SIGNED_OUT') {
        setUsuario(null)
        setCarregando(false)
        router.replace('/login')
        return
      }

      // TOKEN_REFRESHED: atualizar store apenas se for usuário diferente
      if (event === 'TOKEN_REFRESHED' && session?.user && usuario?.id !== session.user.id) {
        const usuarioDB = await buscarUsuarioDB(session.user.id)
        if (montado && usuarioDB) setUsuario(usuarioDB, session.user.email ?? undefined)
      }
    })

    return () => {
      montado = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guard de pathname
  useEffect(() => {
    if (carregando || splash) return
    const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r))
    if (!usuario && !rotaPublica) router.replace('/login')
  }, [pathname, usuario, carregando, splash, router])

  if (splash || carregando) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: 'var(--hf-black)' }}>
        <div className="animate-fade-in-up flex flex-col items-center">
          <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', textAlign: 'center' }}>
            <p style={{ fontSize: 32, fontWeight: 500, letterSpacing: '0.2em', color: '#FFFFFF', margin: 0 }}>HOFFMANN</p>
            <p style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--hf-gold)', marginTop: 4, fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>
              CLÍNICA ODONTOLÓGICA E ESTÉTICA
            </p>
          </div>
          <p className="mt-3 text-xs tracking-[0.25em] uppercase" style={{ color: 'var(--hf-gold)', fontWeight: 300 }}>
            Sistema Clínico
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