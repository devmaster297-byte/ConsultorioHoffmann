// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

const schema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { setUsuario } = useAuthStore()
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setCarregando(true)
    setErro(null)

    const supabase = createClient()

    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.senha,
    })

    if (authError || !auth.user) {
      setErro(`Email ou senha incorretos`)
      setCarregando(false)
      return
    }

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', auth.user.id)
      .single()

    if (userError || !usuario) {
      setErro('Perfil não encontrado. Contate o administrador.')
      await supabase.auth.signOut()
      setCarregando(false)
      return
    }

    setUsuario(usuario)

    // Reload completo para evitar conflito com AuthProvider
    window.location.href = '/pacientes'
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl shadow-lg">
            🦷
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Consultório Hoffmann</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão simples para seu consultório</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="dentista@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              {...register('senha')}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.senha && <p className="mt-1 text-xs text-red-500">{errors.senha.message}</p>}
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-blue-700 transition-colors"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}