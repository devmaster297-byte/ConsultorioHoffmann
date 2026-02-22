// src/app/api/debug/route.ts
// ⚠️  REMOVER APÓS RESOLVER O PROBLEMA
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const info: Record<string, unknown> = {
    supabase_url_definida: !!url,
    supabase_url_valor:    url ? url.slice(0, 35) + '...' : 'VAZIO',
    supabase_key_definida: !!key,
    supabase_key_valor:    key ? key.slice(0, 25) + '...' : 'VAZIO',
    node_env:              process.env.NODE_ENV,
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    info.auth_error  = authErr?.message ?? null
    info.user_logado = !!user
    info.user_id     = user?.id ?? null

    if (user) {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, perfil, ativo, clinica_id')
        .eq('id', user.id)
        .single()

      info.usuarios_data  = data
      info.usuarios_error = error?.message ?? null
      info.usuarios_code  = error?.code ?? null
    }

    // Testar query sem auth para ver se RLS bloqueia
    const { data: teste, error: testeErr } = await supabase
      .from('clinicas')
      .select('id, nome')
      .limit(1)

    info.clinicas_acessivel = !testeErr
    info.clinicas_error     = testeErr?.message ?? null

  } catch (e: unknown) {
    info.exception = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(info, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}