// src/app/api/whatsapp/qrcode/route.ts
// Busca o QR code de conexão da instância Evolution API.
// Aceita a config no body para não depender de cookies de sessão,
// que podem falhar em rotas de API dependendo da configuração do middleware.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Receber config diretamente do body — o cliente já tem esses valores
  // (vieram do banco via supabase-browser autenticado normalmente)
  let body: { url?: string; instance?: string; apikey?: string } = {}
  try { body = await req.json() } catch {}

  const { url, instance, apikey } = body

  if (!url || !instance || !apikey) {
    return NextResponse.json(
      { error: 'Preencha e salve a URL, instância e API key antes de gerar o QR code.' },
      { status: 422 }
    )
  }

  // Chamar Evolution API — endpoint de conexão/QR code
  const endpoint = `${url.replace(/\/$/, '')}/instance/connect/${instance}`

  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey },
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

  // Normalizar o base64 — a Evolution API retorna em formatos diferentes por versão
  const base64 =
    data?.base64 ||
    data?.qrcode?.base64 ||
    data?.qr?.base64 ||
    null

  if (!base64) {
    const state = data?.instance?.state ?? data?.state ?? ''
    if (state === 'open') {
      return NextResponse.json({ conectado: true })
    }
    return NextResponse.json(
      { error: 'QR code não disponível. A instância pode já estar conectada ou em estado inválido.' },
      { status: 422 }
    )
  }

  const qrBase64 = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
  return NextResponse.json({ base64: qrBase64 })
}