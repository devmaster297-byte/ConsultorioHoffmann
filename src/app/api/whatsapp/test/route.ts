// src/app/api/whatsapp/test/route.ts
// Testa a conexão com a Evolution API verificando o status da instância.
// Também usado pela página de configuração para validar os dados antes de salvar.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 1. Autenticar
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Aceitar config do body (para testar antes de salvar) OU ler do banco
  let url: string, instance: string, apikey: string

  let body: { url?: string; instance?: string; apikey?: string } = {}
  try { body = await req.json() } catch {}

  if (body.url && body.instance && body.apikey) {
    // Teste com config passada no body (tela de configuração)
    url      = body.url.trim()
    instance = body.instance.trim()
    apikey   = body.apikey.trim()
  } else {
    // Lê do banco (para testar config já salva)
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

  // 3. Consultar estado da instância na Evolution API
  const endpoint = `${url.replace(/\/$/, '')}/instance/connectionState/${instance}`

  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, erro: `Falha ao conectar: ${msg}` },
      { status: 502 }
    )
  }

  if (!resp.ok) {
    return NextResponse.json(
      { ok: false, erro: `HTTP ${resp.status} — verifique a URL e o nome da instância` },
      { status: 200 }   // 200 para o cliente processar o erro de negócio
    )
  }

  const data = await resp.json().catch(() => ({}))
  const state = data?.instance?.state ?? data?.state ?? ''

  if (state === 'open') {
    return NextResponse.json({ ok: true })
  }

  const erros: Record<string, string> = {
    close:      'Instância desconectada — escaneie o QR code novamente',
    connecting: 'Instância conectando — aguarde alguns segundos e tente de novo',
    qr:         'Aguardando leitura do QR code no WhatsApp',
  }

  return NextResponse.json({
    ok: false,
    erro: erros[state] ?? `Estado desconhecido: ${state || 'sem resposta'}`,
  })
}