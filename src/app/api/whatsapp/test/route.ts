// src/app/api/whatsapp/test/route.ts
// Testa a conexão com a Evolution API verificando o status da instância.
// Dois modos:
//   1. Config no body → testa diretamente sem auth (usado na tela de configuração)
//   2. Sem config no body → lê do banco (exige auth, usado pelo polling da tela de QR)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  let body: { url?: string; instance?: string; apikey?: string } = {}
  try { body = await req.json() } catch {}

  let url: string, instance: string, apikey: string

  if (body.url && body.instance && body.apikey) {
    // ── Modo 1: config passada no body (teste da tela de configuração) ──
    // Não exige autenticação pois não acessa o banco — apenas testa
    // a conectividade com o servidor da Evolution API.
    url      = body.url.trim()
    instance = body.instance.trim()
    apikey   = body.apikey.trim()
  } else {
    // ── Modo 2: lê config do banco (polling após gerar QR) ──
    // Aqui sim exige autenticação pois acessa a tabela clinicas.
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('clinica_id')
      .eq('id', user.id)
      .single()

    const { data: clinica } = await supabase
      .from('clinicas')
      .select('evolution_url, evolution_instance, evolution_apikey')
      .eq('id', usuario?.clinica_id)
      .single()

    if (!clinica?.evolution_url || !clinica?.evolution_instance || !clinica?.evolution_apikey) {
      return NextResponse.json({ error: 'WhatsApp não configurado' }, { status: 422 })
    }

    url      = clinica.evolution_url
    instance = clinica.evolution_instance
    apikey   = clinica.evolution_apikey
  }

  // Consultar estado da instância na Evolution API
  const endpoint = `${url.replace(/\/$/, '')}/instance/connectionState/${instance}`

  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, erro: `Falha ao conectar: ${msg}` },
      { status: 200 }
    )
  }

  if (!resp.ok) {
    return NextResponse.json(
      { ok: false, erro: `HTTP ${resp.status} — verifique a URL e o nome da instância` },
      { status: 200 }
    )
  }

  const data = await resp.json().catch(() => ({}))
  const state = data?.instance?.state ?? data?.state ?? ''

  if (state === 'open') {
    return NextResponse.json({ ok: true })
  }

  const erros: Record<string, string> = {
    close:      'Instância desconectada — gere um QR code para reconectar',
    connecting: 'Instância conectando — aguarde alguns segundos e tente de novo',
    qr:         'Aguardando leitura do QR code no WhatsApp',
  }

  return NextResponse.json({
    ok: false,
    erro: erros[state] ?? `Estado: ${state || 'sem resposta da instância'}`,
  })
}