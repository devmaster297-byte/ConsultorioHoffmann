// src/app/(app)/configuracoes/whatsapp/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Wifi, WifiOff, Eye, EyeOff, HelpCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { testarConexaoWhatsApp } from '@/lib/whatsapp'

export default function WhatsAppConfigPage() {
  const router = useRouter()
  const clinicaId = useAuthStore(s => s.clinicaId)

  const [url,      setUrl]      = useState('')
  const [instance, setInstance] = useState('')
  const [apikey,   setApikey]   = useState('')
  const [showKey,  setShowKey]  = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo,    setSalvo]    = useState(false)
  const [erro,     setErro]     = useState('')
  const [testando, setTestando] = useState(false)
  const [statusConexao, setStatusConexao] = useState<'ok' | 'erro' | null>(null)
  const [erroConexao,   setErroConexao]   = useState('')

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

  async function salvar() {
    if (!clinicaId) return
    setSalvando(true); setErro('')
    const { error } = await supabase
      .from('clinicas')
      .update({ evolution_url: url.trim(), evolution_instance: instance.trim(), evolution_apikey: apikey.trim() })
      .eq('id', clinicaId)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  async function testar() {
    if (!url || !instance || !apikey) {
      setErroConexao('Preencha todos os campos antes de testar.')
      setStatusConexao('erro')
      return
    }
    setTestando(true); setStatusConexao(null); setErroConexao('')
    const resultado = await testarConexaoWhatsApp({
      url: url.trim(), instance: instance.trim(), apikey: apikey.trim(),
    })
    setTestando(false)
    setStatusConexao(resultado.ok ? 'ok' : 'erro')
    if (!resultado.ok) setErroConexao(resultado.erro ?? 'Erro desconhecido')
  }

  const pronto = url.trim() && instance.trim() && apikey.trim()

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
              O sistema usa a Evolution API para enviar mensagens pelo WhatsApp da clínica.
              Você precisa ter uma instância ativa com o WhatsApp escaneado.
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

        {/* Teste de conexão */}
        <button
          onClick={testar}
          disabled={testando || !pronto}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold border-2 border-gray-200 text-gray-600 bg-white active:bg-gray-50 disabled:opacity-40"
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
          {testando ? 'Testando...' : 'Testar conexão'}
        </button>

        {statusConexao === 'ok' && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3">
            <Wifi className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Conectado! WhatsApp pronto para envio.</p>
          </div>
        )}

        {statusConexao === 'erro' && (
          <div className="rounded-2xl bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 font-medium">Falha na conexão</p>
            <p className="text-xs text-red-500 mt-0.5">{erroConexao}</p>
          </div>
        )}

        {erro && (
          <p className="text-xs text-red-500 px-1">{erro}</p>
        )}

        {/* Salvar */}
        <button
          onClick={salvar}
          disabled={salvando || !pronto}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
            salvo ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          <Save className="h-4 w-4" />
          {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}