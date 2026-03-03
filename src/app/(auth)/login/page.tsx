// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [erro, setErro]         = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar() {
    if (!email || !senha) { setErro('Preencha email e senha'); return }
    setCarregando(true)
    setErro(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('Email ou senha incorretos')
      setCarregando(false)
      return
    }

    router.push('/pacientes')
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--hf-black)' }}>

      {/* Topo com logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        <div className="animate-fade-in">
          <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', textAlign: 'center' }}>
            <p style={{ fontSize: 36, fontWeight: 500, letterSpacing: '0.2em', color: '#FFFFFF', margin: 0 }}>HOFFMANN</p>
            <p style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--hf-gold)', marginTop: 4, fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>CLÍNICA ODONTOLÓGICA E ESTÉTICA</p>
          </div>
          <div className="mt-2 mb-12 text-center">
            <span className="text-xs tracking-[0.3em] uppercase"
              style={{ color: 'var(--hf-gold)', fontWeight: 300 }}>
              Sistema Clínico
            </span>
          </div>
        </div>

        {/* Card de login */}
        <div className="w-full max-w-sm rounded-2xl p-8 space-y-5 animate-fade-in-up-delay"
          style={{
            background: 'var(--hf-black-soft)',
            border: '1px solid rgba(201,169,110,0.15)',
          }}>

          <div>
            <label className="block text-xs tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--hf-gray-400)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              autoComplete="email"
              className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(201,169,110,0.2)',
                color: 'var(--hf-white)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--hf-gold)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(201,169,110,0.2)'}
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--hf-gray-400)' }}>
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              autoComplete="current-password"
              className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(201,169,110,0.2)',
                color: 'var(--hf-white)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--hf-gold)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(201,169,110,0.2)'}
            />
          </div>

          {erro && (
            <p className="text-xs text-center py-2 rounded-lg"
              style={{ color: '#E88080', background: 'rgba(140,48,48,0.15)' }}>
              {erro}
            </p>
          )}

          <button
            onClick={entrar}
            disabled={carregando}
            className="w-full py-4 rounded-xl text-sm font-semibold tracking-wide transition-all disabled:opacity-60 mt-2"
            style={{
              background: 'linear-gradient(135deg, var(--hf-gold) 0%, #B8935A 100%)',
              color: 'var(--hf-black)',
              boxShadow: '0 4px 20px rgba(201,169,110,0.3)',
            }}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>

      {/* Rodapé */}
      <div className="pb-10 text-center">
        <p className="text-xs" style={{ color: 'var(--hf-gray-500)' }}>
          Hoffmann © {new Date().getFullYear()}
        </p>
      </div>

    </div>
  )
}