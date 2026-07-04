// src/app/api/whatsapp/qrcode/route.ts
// Busca o QR code de conexão da instância Evolution API.
// A chamada é feita server-side para não expor a apikey no browser.
// O QR code expira em ~60 segundos — o cliente pode chamar novamente para regenerar.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  // 1. Autenticar
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Buscar clinica_id do usuário
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('clinica_id')
    .eq('id', user.id)
    .single()

  if (!usuario?.clinica_id) {
    return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
  }

  // 3. Buscar config da Evolution API
  const { data: clinica } = await supabase
    .from('clinicas')
    .select('evolution_url, evolution_instance, evolution_apikey')
    .eq('id', usuario.clinica_id)
    .single()

  if (!clinica?.evolution_url || !clinica?.evolution_instance || !clinica?.evolution_apikey) {
    return NextResponse.json(
      { error: 'WhatsApp não configurado. Preencha a URL, instância e API key primeiro.' },
      { status: 422 }
    )
  }

  // 4. Chamar Evolution API — endpoint de conexão/QR code
  const endpoint = `${clinica.evolution_url.replace(/\/$/, '')}/instance/connect/${clinica.evolution_instance}`

  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey: clinica.evolution_apikey },
      // QR code requests podem demorar alguns segundos
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Falha ao conectar com a Evolution API: ${msg}` },
      { status: 502 }
    )
  }

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '')
    return NextResponse.json(
      { error: `Evolution API retornou ${resp.status}: ${texto.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const data = await resp.json().catch(() => ({}))

  // A Evolution API pode retornar o base64 em diferentes formatos dependendo da versão:
  // v1: { base64: "data:image/png;base64,..." }
  // v2: { qrcode: { base64: "data:image/png;base64,..." }, code: "..." }
  // Normalizamos para sempre retornar { base64: "..." }
  const base64 =
    data?.base64 ||
    data?.qrcode?.base64 ||
    data?.qr?.base64 ||
    null

  if (!base64) {
    // Se não veio QR code, a instância pode já estar conectada
    const state = data?.instance?.state ?? data?.state ?? ''
    if (state === 'open') {
      return NextResponse.json({ conectado: true })
    }
    return NextResponse.json(
      { error: 'QR code não disponível. A instância pode já estar conectada ou em estado inválido.' },
      { status: 422 }
    )
  }

  // Garantir que o base64 tem o prefixo de data URL
  const qrBase64 = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`

  return NextResponse.json({ base64: qrBase64 })
}