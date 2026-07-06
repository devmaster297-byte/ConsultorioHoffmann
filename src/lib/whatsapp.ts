// src/lib/whatsapp.ts
// Integração com Evolution API para envio de mensagens WhatsApp

export interface ConfigWhatsApp {
  url: string        // ex: https://api.seudominio.com
  instance: string   // nome da instância na Evolution API
  apikey: string     // API key da instância
}

export interface ResultadoEnvio {
  ok: boolean
  erro?: string
}

/**
 * Converte qualquer formato de telefone brasileiro para E.164 sem o +:
 * "(27) 99525-5407" → "5527995255407"
 * "27995255407"     → "5527995255407"
 * "995255407"       → "5527995255407" (sem DDD — improvável, mas trata)
 */
export function formatarNumeroWhatsApp(telefone: string): string {
  const apenas = telefone.replace(/\D/g, '')

  // Já tem código do país (55 + DDD + número = 12 ou 13 dígitos)
  if (apenas.startsWith('55') && apenas.length >= 12) return apenas

  // Tem DDD + número (10 ou 11 dígitos)
  if (apenas.length >= 10) return `55${apenas}`

  // Só número sem DDD — retorna como está (vai falhar no envio, mas não travar)
  return `55${apenas}`
}

/**
 * Envia uma mensagem de texto via proxy server-side (/api/whatsapp/send).
 * Passa a config no body — padrão consistente com /api/whatsapp/test e /qrcode.
 * A chamada real à Evolution API é feita pelo servidor Next.js, evitando CORS.
 */
export async function enviarMensagemWhatsApp(
  config: ConfigWhatsApp,
  telefone: string,
  mensagem: string,
): Promise<ResultadoEnvio> {
  try {
    const resp = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:      config.url,
        instance: config.instance,
        apikey:   config.apikey,
        telefone,
        mensagem,
      }),
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok || data.error) {
      return { ok: false, erro: data.error ?? `Erro HTTP ${resp.status}` }
    }

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: msg }
  }
}

/**
 * Testa a conexão via proxy server-side (/api/whatsapp/test).
 * Passa a config no body para que seja possível testar antes de salvar.
 */
export async function testarConexaoWhatsApp(config: ConfigWhatsApp): Promise<ResultadoEnvio> {
  try {
    const resp = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:      config.url,
        instance: config.instance,
        apikey:   config.apikey,
      }),
    })

    const data = await resp.json().catch(() => ({}))

    if (data.ok) return { ok: true }
    return { ok: false, erro: data.erro ?? data.error ?? 'Erro desconhecido' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: msg }
  }
}

// ─── Templates de mensagem ────────────────────────────────────────────────────

export function templateCobranca(params: {
  nomePaciente: string
  saldo: number
  nomeClinica?: string
}): string {
  const valor = params.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const clinica = params.nomeClinica ?? 'Consultório Hoffmann'
  const primeiro = params.nomePaciente.split(' ')[0]

  return `Olá, *${primeiro}*! 😊

Passando para informar que identificamos um saldo em aberto de *${valor}* referente ao seu tratamento aqui no *${clinica}*.

Se já realizou o pagamento, desconsidere esta mensagem. Caso tenha dúvidas ou queira combinar a melhor forma de quitação, é só responder aqui. 🙏

Obrigada! ✨`
}

export function templateLembrete(params: {
  nomePaciente: string
  nomeClinica?: string
}): string {
  const clinica = params.nomeClinica ?? 'Consultório Hoffmann'
  const primeiro = params.nomePaciente.split(' ')[0]

  return `Olá, *${primeiro}*! 👋

Gostaríamos de lembrá-lo(a) que possui valores pendentes com o *${clinica}*.

Entre em contato para verificarmos juntos a melhor forma de regularização. Estamos à disposição! 😊`
}