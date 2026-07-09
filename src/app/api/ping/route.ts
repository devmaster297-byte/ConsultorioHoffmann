// src/app/api/ping/route.ts
// Mantém o projeto Supabase ativo durante períodos sem acesso.
// O Supabase pausa projetos gratuitos após 7 dias sem nenhuma chamada à API.
// Este endpoint é chamado diariamente pelo Vercel Cron (ver vercel.json).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

function tokensMatch(a: string, b: string): boolean {
  // Hasheia ambos os valores antes de comparar: SHA-256 sempre gera 32 bytes,
  // então os buffers têm sempre o mesmo tamanho e a comparação em tempo
  // constante não vaza nem o comprimento nem o conteúdo do secret.
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET

  // Fail-closed: sem secret configurado, o endpoint recusa por padrão
  // em vez de liberar acesso irrestrito.
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado' },
      { status: 500 }
    )
  }

  // O Vercel envia o CRON_SECRET como Bearer Token no cabeçalho Authorization.
  const authHeader = req.headers.get('authorization')
  const cronToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null

  // Permite fallback para query param apenas para testes manuais
  const token = cronToken ?? req.nextUrl.searchParams.get('token')

  if (!token || !tokensMatch(token, secret)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Usar service role ou anon key — apenas uma consulta leve de contagem
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Variáveis de ambiente não configuradas' },
      { status: 500 }
    )
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