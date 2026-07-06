// src/app/api/whatsapp/send/route.ts
// Proxy server-side para Evolution API — evita CORS e expõe a apikey no browser.
// Recebe a config no body (padrão consistente com /api/whatsapp/test e /qrcode).
// O registro no histórico (mensagens_whatsapp) é feito pelo cliente, que tem
// sessão autenticada via supabase-browser.

import { NextRequest, NextResponse } from 'next/server'

// Limite simples em memória (por processo Vercel) — evita spam acidental.
// Para rate limiting persistente, o cliente verifica o histórico antes de enviar.
const enviosRecentes = new Map<string, number[]>()

function checarRateLimit(instancia: string): boolean {
  const agora = Date.now()
  const janela = 5 * 60 * 1000   // 5 minutos
  const limite = 20               // máx 20 mensagens por instância a cada 5 min

  const timestamps = (enviosRecentes.get(instancia) ?? [])
    .filter(t => agora - t < janela)

  if (timestamps.length >= limite) return false

  timestamps.push(agora)
  enviosRecentes.set(instancia, timestamps)
  return true
}

function formatarNumero(telefone: string): string {
  const apenas = telefone.replace(/\D/g, '')
  if (apenas.startsWith('55') && apenas.length >= 12) return apenas
  if (apenas.length >= 10) return `55${apenas}`
  return `55${apenas}`
}

export async function POST(req: NextRequest) {
  let body: {
    url?: string
    instance?: string
    apikey?: string
    telefone?: string
    mensagem?: string
  } = {}

  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { url, instance, apikey, telefone, mensagem } = body

  if (!url || !instance || !apikey || !telefone || !mensagem) {
    return NextResponse.json(
      { error: 'url, instance, apikey, telefone e mensagem são obrigatórios' },
      { status: 400 }
    )
  }

  // Rate limiting leve por instância
  if (!checarRateLimit(instance)) {
    return NextResponse.json(
      { error: 'Limite de envios atingido. Aguarde alguns minutos.' },
      { status: 429 }
    )
  }

  // Formatar número e chamar Evolution API (server → server, sem CORS)
  const numero   = formatarNumero(telefone)
  const endpoint = `${url.replace(/\/$/, '')}/message/sendText/${instance}`

  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey,
      },
      body: JSON.stringify({ number: numero, text: mensagem }),
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

  return NextResponse.json({ ok: true })
}