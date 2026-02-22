// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

const ROTAS_PUBLICAS = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          // Já temos dados no store persistido e são do mesmo usuário
          if (usuario?.id === session.user.id && usuario?.clinica_id) {
            setCarregando(false)
            return
          }

          // Buscar perfil do banco
          const { data: usuarioDB } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (usuarioDB) {
            setUsuario(usuarioDB)
            setCarregando(false)
          } else {
            // Auth existe mas sem perfil → logout
            await supabase.auth.signOut()
            setUsuario(null)
            setCarregando(false)
            window.location.href = '/login'
          }
        } else {
          // Sem sessão
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
  }, [pathname])

  if (carregando) {
    return (
      <div style={{
        display: 'flex',
        height: '100svh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>🦷</span>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '2px solid #3b82f6',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <>{children}</>
}