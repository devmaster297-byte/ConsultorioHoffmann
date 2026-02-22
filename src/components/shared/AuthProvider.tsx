// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const carregado = useRef(false)

  useEffect(() => {
    if (carregado.current) return
    carregado.current = true

    const supabase = createClient()

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          const { data: usuario } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (usuario) {
            setUsuario(usuario)
          }
        }
      } catch (e) {
        console.error('AuthProvider erro:', e)
      } finally {
        setCarregando(false)
      }
    }

    init()
  }, [setUsuario])

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