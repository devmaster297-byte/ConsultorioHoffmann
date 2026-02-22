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

    // Função que atualiza o estado com base na sessão
    const atualizarUsuario = async (session: any) => {
      if (session?.user) {
        // Se o usuário já está no store e é o mesmo, apenas finaliza carregamento
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
        } else {
          // Autenticado mas sem perfil → faz logout
          await supabase.auth.signOut()
          setUsuario(null)
          if (!ROTAS_PUBLICAS.some(r => pathname.startsWith(r))) {
            router.push('/login')
          }
        }
      } else {
        setUsuario(null)
        if (!ROTAS_PUBLICAS.some(r => pathname.startsWith(r))) {
          router.push('/login')
        }
      }
      setCarregando(false)
    }

    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      atualizarUsuario(session)
    })

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      atualizarUsuario(session)
    })

    return () => subscription?.unsubscribe()
  }, [pathname, router, setUsuario, usuario]) // pathname ainda é necessário para redirecionar ao trocar de rota sem usuário

  // Este useEffect cuida do redirecionamento quando a rota muda e o usuário não está autenticado
  useEffect(() => {
    if (!carregando && !usuario && !ROTAS_PUBLICAS.some(r => pathname.startsWith(r))) {
      router.push('/login')
    }
  }, [pathname, usuario, carregando, router])

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