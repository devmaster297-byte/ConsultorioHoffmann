// src/app/(app)/configuracoes/whatsapp/page.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Wifi, WifiOff, Eye, EyeOff,
  HelpCircle, QrCode, RefreshCw, CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { testarConexaoWhatsApp } from '@/lib/whatsapp'

// Tempo de vida do QR code em milissegundos (Evolution API expira em ~60s)
const QR_LIFETIME_MS = 55_000
// Intervalo de polling para verificar se o WhatsApp conectou
const POLL_INTERVAL_MS = 3_000

export default function WhatsAppConfigPage() {
  const router   = useRouter()
  const clinicaId = useAuthStore(s => s.clinicaId)

  // ── Campos de configuração ─────────────────────────────────────────
  const [url,      setUrl]      = useState('')
  const [instance, setInstance] = useState('')
  const [apikey,   setApikey]   = useState('')
  const [showKey,  setShowKey]  = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo,    setSalvo]    = useState(false)
  const [erroSalvo, setErroSalvo] = useState('')

  // ── Status de conexão ──────────────────────────────────────────────
  const [statusConexao, setStatusConexao] = useState<'ok' | 'erro' | 'desconhecido'>('desconhecido')
  const [erroConexao,   setErroConexao]   = useState('')
  const [testando,      setTestando]      = useState(false)

  // ── QR Code ────────────────────────────────────────────────────────
  const [qrBase64,      setQrBase64]      = useState<string | null>(null)
  const [carregandoQr,  setCarregandoQr]  = useState(false)
  const [erroQr,        setErroQr]        = useState('')
  const [qrExpirado,    setQrExpirado]    = useState(false)
  const [conectando,    setConectando]    = useState(false)  // polling ativo

  const pollingRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiryRef   = useRef<ReturnType<typeof setTimeout>  | null>(null)

  // ── Carregar config salva ──────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!clinicaId) return
    const { data } = await supabase
      .from('clinicas')
      .select('evolution_url, evolution_instance, evolution_apikey')
      .eq('id', clinicaId)
      .single()
    if (data) {
      setUrl(data.evolution_url ?? '')
      setInstance(data.evolution_instance ?? '')
      setApikey(data.evolution_apikey ?? '')
    }
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])

  // Parar polling e timers quando o componente desmontar
  useEffect(() => () => {
    if (pollingRef.current)  clearInterval(pollingRef.current)
    if (expiryRef.current)   clearTimeout(expiryRef.current)
  }, [])

  // ── Salvar ─────────────────────────────────────────────────────────
  async function salvar() {
    if (!clinicaId) return
    setSalvando(true); setErroSalvo('')
    const { error } = await supabase
      .from('clinicas')
      .update({
        evolution_url:      url.trim(),
        evolution_instance: instance.trim(),
        evolution_apikey:   apikey.trim(),
      })
      .eq('id', clinicaId)
    setSalvando(false)
    if (error) { setErroSalvo(error.message); return }
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  // ── Testar conexão ─────────────────────────────────────────────────
  async function testar() {
    if (!url || !instance || !apikey) {
      setErroConexao('Preencha todos os campos antes de testar.')
      setStatusConexao('erro')
      return
    }
    setTestando(true); setStatusConexao('desconhecido'); setErroConexao('')
    const res = await testarConexaoWhatsApp({
      url: url.trim(), instance: instance.trim(), apikey: apikey.trim(),
    })
    setTestando(false)
    setStatusConexao(res.ok ? 'ok' : 'erro')
    if (!res.ok) setErroConexao(res.erro ?? 'Erro desconhecido')
  }

  // ── Polling: verificar se conectou ─────────────────────────────────
  function iniciarPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current)
    setConectando(true)

    pollingRef.current = setInterval(async () => {
      const resp = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:      url.trim(),
          instance: instance.trim(),
          apikey:   apikey.trim(),
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (data.ok) {
        // Conectou!
        if (pollingRef.current) clearInterval(pollingRef.current)
        if (expiryRef.current)  clearTimeout(expiryRef.current)
        setQrBase64(null)
        setQrExpirado(false)
        setConectando(false)
        setStatusConexao('ok')
        setErroConexao('')
      }
    }, POLL_INTERVAL_MS)
  }

  // ── Gerar QR Code ──────────────────────────────────────────────────
  async function gerarQrCode() {
    // Limpar estado anterior
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (expiryRef.current)  clearTimeout(expiryRef.current)
    setQrBase64(null)
    setQrExpirado(false)
    setErroQr('')
    setCarregandoQr(true)
    setConectando(false)

    const resp = await fetch('/api/whatsapp/qrcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:      url.trim(),
        instance: instance.trim(),
        apikey:   apikey.trim(),
      }),
    })
    const data = await resp.json().catch(() => ({}))
    setCarregandoQr(false)

    if (data.conectado) {
      // Já estava conectado — atualiza status
      setStatusConexao('ok')
      return
    }

    if (!resp.ok || data.error) {
      setErroQr(data.error ?? 'Não foi possível gerar o QR code.')
      return
    }

    setQrBase64(data.base64)

    // Marcar expiração após QR_LIFETIME_MS
    expiryRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      setQrExpirado(true)
      setConectando(false)
    }, QR_LIFETIME_MS)

    // Iniciar polling para detectar conexão
    iniciarPolling()
  }

  const configSalva = url.trim() && instance.trim() && apikey.trim()
  const mostrarQr   = configSalva  // só mostra seção de QR quando há config salva

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">WhatsApp</h1>
          <p className="text-xs text-gray-400">Configuração da Evolution API</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Info */}
        <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
          <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-blue-800">Como funciona</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Preencha os dados da Evolution API, salve, e use o botão
              <strong> Conectar WhatsApp</strong> para escanear o QR code com o
              celular da clínica. Quando o WhatsApp desconectar, basta gerar
              um novo QR aqui — sem precisar acessar o servidor.
            </p>
          </div>
        </div>

        {/* Campos */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
          <div className="px-4 py-4 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">URL da API</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.seudominio.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mt-1"
            />
            <p className="text-xs text-gray-400">Endereço onde a Evolution API está hospedada</p>
          </div>

          <div className="px-4 py-4 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome da Instância</label>
            <input
              type="text"
              value={instance}
              onChange={e => setInstance(e.target.value)}
              placeholder="hoffmann"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mt-1"
            />
            <p className="text-xs text-gray-400">Nome exato da instância criada na Evolution API</p>
          </div>

          <div className="px-4 py-4 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apikey}
                onChange={e => setApikey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">Chave de autenticação da instância</p>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={testar}
            disabled={testando || !configSalva}
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold border-2 border-gray-200 text-gray-600 bg-white active:bg-gray-50 disabled:opacity-40"
          >
            {testando ? (
              <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : statusConexao === 'ok' ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : statusConexao === 'erro' ? (
              <WifiOff className="h-4 w-4 text-red-500" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            {testando ? 'Testando...' : 'Testar'}
          </button>

          <button
            onClick={salvar}
            disabled={salvando || !configSalva}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
              salvo
                ? 'bg-emerald-500 text-white'
                : 'bg-blue-600 text-white active:bg-blue-700'
            }`}
          >
            <Save className="h-4 w-4" />
            {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar'}
          </button>
        </div>

        {/* Feedback de conexão */}
        {statusConexao === 'ok' && !qrBase64 && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">WhatsApp conectado e pronto para envio!</p>
          </div>
        )}

        {statusConexao === 'erro' && (
          <div className="rounded-2xl bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 font-medium">Falha na conexão</p>
            <p className="text-xs text-red-500 mt-0.5">{erroConexao}</p>
          </div>
        )}

        {erroSalvo && (
          <p className="text-xs text-red-500 px-1">{erroSalvo}</p>
        )}

        {/* ── Seção de QR Code ───────────────────────────────────────── */}
        {mostrarQr && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-900">Conectar WhatsApp</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Use quando o WhatsApp desconectar — escaneie o QR code com o celular da clínica
              </p>
            </div>

            <div className="px-4 py-4 space-y-3">
              {/* Estado: aguardando gerar */}
              {!qrBase64 && !carregandoQr && !qrExpirado && (
                <button
                  onClick={gerarQrCode}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white py-3.5 text-sm font-semibold active:bg-gray-700"
                >
                  <QrCode className="h-4 w-4" />
                  Gerar QR Code
                </button>
              )}

              {/* Estado: carregando */}
              {carregandoQr && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <span className="h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Gerando QR code...</p>
                </div>
              )}

              {/* Estado: QR code disponível */}
              {qrBase64 && !qrExpirado && (
                <div className="flex flex-col items-center gap-3">
                  {/* QR Code */}
                  <div className="p-3 bg-white border-2 border-gray-100 rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrBase64}
                      alt="QR Code WhatsApp"
                      className="w-56 h-56 object-contain"
                    />
                  </div>

                  {/* Instrução */}
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-gray-800">
                      Abra o WhatsApp no celular da clínica
                    </p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Toque em <strong>⋮ Menu → Dispositivos conectados → Conectar dispositivo</strong>
                      {' '}e aponte a câmera para este QR code
                    </p>
                  </div>

                  {/* Barra de expiração + polling */}
                  <div className="w-full space-y-2">
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          animation: `shrink ${QR_LIFETIME_MS}ms linear forwards`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-center text-gray-400">
                      {conectando
                        ? '🔄 Aguardando leitura...'
                        : 'QR code expira em breve'}
                    </p>
                  </div>
                </div>
              )}

              {/* Estado: expirado */}
              {qrExpirado && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                    <QrCode className="h-7 w-7 text-amber-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800">QR code expirado</p>
                    <p className="text-xs text-gray-400 mt-0.5">Gere um novo para tentar novamente</p>
                  </div>
                  <button
                    onClick={gerarQrCode}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold active:bg-gray-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Gerar novo QR
                  </button>
                </div>
              )}

              {/* Erro ao gerar QR */}
              {erroQr && (
                <div className="rounded-xl bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700 font-medium">Não foi possível gerar o QR code</p>
                  <p className="text-xs text-red-500 mt-0.5">{erroQr}</p>
                </div>
              )}

              {/* Sucesso: conectou via QR */}
              {statusConexao === 'ok' && qrBase64 === null && conectando === false && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-emerald-700 font-semibold">Conectado com sucesso!</p>
                    <p className="text-xs text-emerald-500 mt-0.5">WhatsApp pronto para envio de mensagens</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* CSS da barra de expiração */}
      <style jsx global>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
    </div>
  )
}