// src/components/shared/AuthProvider.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, usuario } = useAuthStore()
  const [carregando, setCarregando] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    // Carregar sessão atual ao montar
    async function carregarSessao() {
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
          // Usuário autenticado mas sem registro — forçar logout
          await supabase.auth.signOut()
          setUsuario(null)
        }
      } else {
        setUsuario(null)
      }

      setCarregando(false)
    }

    carregarSessao()

    // Escutar mudanças de autenticação (login/logout em outras abas, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUsuario(null)
          router.push('/login')
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const { data: usuarioDB } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (usuarioDB) {
            setUsuario(usuarioDB)
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUsuario, router])

  // Tela de loading enquanto verifica sessão
  if (carregando) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl">🦷</div>
          <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
