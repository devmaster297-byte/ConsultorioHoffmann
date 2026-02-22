// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const router = useRouter()
  // Flag para evitar que onAuthStateChange redirecione antes de carregarSessao terminar
  const inicializado = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    async function carregarSessao() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: usuarioDB } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', user.id)
            .single()

          if (usuarioDB) {
            setUsuario(usuarioDB)
          } else {
            await supabase.auth.signOut()
            setUsuario(null)
          }
        } else {
          setUsuario(null)
        }
      } catch (e) {
        console.error('Erro ao carregar sessão:', e)
        setUsuario(null)
      } finally {
        inicializado.current = true
        setCarregando(false)
      }
    }

    carregarSessao()

    // Só reage a mudanças APÓS a carga inicial terminar
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!inicializado.current) return

        if (event === 'SIGNED_OUT' || !session) {
          setUsuario(null)
          router.push('/login')
          return
        }

        if (event === 'SIGNED_IN') {
          const { data: usuarioDB } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (usuarioDB) {
            setUsuario(usuarioDB)
            router.push('/pacientes')
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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