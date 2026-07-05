// src/app/api/ping/route.ts
// Mantém o projeto Supabase ativo durante períodos sem acesso.
// O Supabase pausa projetos gratuitos após 7 dias sem nenhuma chamada à API.
// Este endpoint é chamado diariamente pelo Vercel Cron (ver vercel.json).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  // Verificar token secreto para impedir chamadas externas não autorizadas
  const token = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('token')
  const secret = process.env.CRON_SECRET

  if (secret && token !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Usar service role ou anon key — apenas uma consulta leve de contagem
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Variáveis de ambiente não configuradas' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Consulta mínima — só conta quantas clínicas existem (1 linha, sem dados sensíveis)
  const inicio = Date.now()
  const { count, error } = await supabase
    .from('clinicas')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json(
      { ok: false, erro: error.message, timestamp: new Date().toISOString() },
      { status: 502 }
    )
  }

  const ms = Date.now() - inicio

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    latencia_ms: ms,
    clinicas: count,
  })
}