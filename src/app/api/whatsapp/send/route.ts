// src/app/api/whatsapp/send/route.ts
// Proxy server-side para Evolution API.
// Motivação: chamar a Evolution API direto do browser causaria erro de CORS
// e exporia a API key no cliente. Esta rota recebe a requisição autenticada,
// busca a config no banco e faz a chamada de servidor para servidor.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 1. Autenticar o usuário via session cookie do Supabase
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Ler corpo da requisição
  let body: { telefone: string; mensagem: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { telefone, mensagem } = body
  if (!telefone || !mensagem) {
    return NextResponse.json({ error: 'telefone e mensagem são obrigatórios' }, { status: 400 })
  }

  // 3. Buscar config da Evolution API para a clínica do usuário
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('clinica_id')
    .eq('id', user.id)
    .single()

  if (!usuario?.clinica_id) {
    return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
  }

  const { data: clinica } = await supabase
    .from('clinicas')
    .select('evolution_url, evolution_instance, evolution_apikey')
    .eq('id', usuario.clinica_id)
    .single()

  if (!clinica?.evolution_url || !clinica?.evolution_instance || !clinica?.evolution_apikey) {
    return NextResponse.json(
      { error: 'WhatsApp não configurado. Acesse Configurações → WhatsApp.' },
      { status: 422 }
    )
  }

  // 4. Formatar número para E.164 sem o +
  const numero = formatarNumero(telefone)

  // 5. Chamar a Evolution API (server → server, sem CORS)
  const endpoint = `${clinica.evolution_url.replace(/\/$/, '')}/message/sendText/${clinica.evolution_instance}`

  let respEvolution: Response
  try {
    respEvolution = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: clinica.evolution_apikey,
      },
      body: JSON.stringify({ number: numero, text: mensagem }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Falha ao conectar com a Evolution API: ${msg}` },
      { status: 502 }
    )
  }

  if (!respEvolution.ok) {
    const texto = await respEvolution.text().catch(() => '')
    return NextResponse.json(
      { error: `Evolution API retornou ${respEvolution.status}: ${texto.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const resultado = await respEvolution.json().catch(() => ({}))
  return NextResponse.json({ ok: true, resultado })
}

function formatarNumero(telefone: string): string {
  const apenas = telefone.replace(/\D/g, '')
  if (apenas.startsWith('55') && apenas.length >= 12) return apenas
  if (apenas.length >= 10) return `55${apenas}`
  return `55${apenas}`
}