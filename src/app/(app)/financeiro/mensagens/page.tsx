// src/app/(app)/financeiro/mensagens/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, MessageCircle, Send, Clock, Check, X,
  AlertTriangle, Phone, ChevronRight, History, Settings,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { formatarMoeda, formatarData } from '@/lib/utils'
import {
  enviarMensagemWhatsApp, templateCobranca, templateLembrete,
  ConfigWhatsApp, formatarNumeroWhatsApp,
} from '@/lib/whatsapp'
import { buscarSaldosOrcamentosAprovados } from '@/lib/hooks/useFinanceiro'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PacientePendente {
  paciente_id:   string
  nome:          string
  telefone:      string | null
  saldo:         number
  tem_vencido:   boolean
  ultima_msg:    string | null   // data da última mensagem enviada
}

interface MensagemHistorico {
  id:            string
  paciente_nome: string
  telefone:      string
  mensagem:      string
  status:        'enviada' | 'erro'
  erro_msg:      string | null
  enviada_por:   string
  created_at:    string
}

type Aba = 'pendentes' | 'historico'

// ─── Hook de dados ────────────────────────────────────────────────────────────

function useCentralMensagens(clinicaId: string) {
  const [pendentes,  setPendentes]  = useState<PacientePendente[]>([])
  const [historico,  setHistorico]  = useState<MensagemHistorico[]>([])
  const [config,     setConfig]     = useState<ConfigWhatsApp | null>(null)
  const [nomeClinica, setNomeClinica] = useState('Consultório Hoffmann')
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)

    // Config da clínica (apikey incluída — lida aqui pelo cliente autenticado
    // e usada apenas para passar para a API route via HTTPS, nunca exposta em UI)
    const { data: clinica } = await supabase
      .from('clinicas')
      .select('nome, evolution_url, evolution_instance, evolution_apikey')
      .eq('id', clinicaId)
      .single()

    if (clinica?.nome) setNomeClinica(clinica.nome)
    if (clinica?.evolution_url && clinica?.evolution_instance && clinica?.evolution_apikey) {
      setConfig({
        url:      clinica.evolution_url,
        instance: clinica.evolution_instance,
        apikey:   clinica.evolution_apikey,
      })
    }

    // Última mensagem enviada por paciente
    const { data: ultsRaw } = await supabase
      .from('mensagens_whatsapp')
      .select('paciente_id, created_at')
      .eq('clinica_id', clinicaId)
      .eq('status', 'enviada')
      .order('created_at', { ascending: false })

    const ultimaMsgPorPac: Record<string, string> = {}
    for (const m of (ultsRaw ?? []) as { paciente_id: string; created_at: string }[]) {
      if (!ultimaMsgPorPac[m.paciente_id]) ultimaMsgPorPac[m.paciente_id] = m.created_at
    }

    // 1. Parcelas pendentes/vencidas direto por clinica_id
    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('lancamento_id, valor, valor_pago, status')
      .eq('clinica_id', clinicaId)
      .in('status', ['pendente', 'pago_parcial', 'vencido'])

    const parcelas = (parcelasRaw ?? []) as Array<{
      lancamento_id: string; valor: number; valor_pago: number | null; status: string
    }>

    // 2. Lançamentos de receita com paciente
    const lancIds = [...new Set(parcelas.map(p => p.lancamento_id))]
    let lancMap: Record<string, string> = {}   // lancamento_id → paciente_id
    if (lancIds.length > 0) {
      const { data: lancsRaw } = await supabase
        .from('financeiro_lancamentos')
        .select('id, paciente_id')
        .in('id', lancIds)
        .eq('tipo', 'receita')
        .not('paciente_id', 'is', null)
      for (const l of (lancsRaw ?? []) as { id: string; paciente_id: string }[]) {
        lancMap[l.id] = l.paciente_id
      }
    }

    // 3. Saldo por paciente (parcelas tradicionais)
    const saldoPorPac: Record<string, { saldo: number; temVencido: boolean }> = {}
    for (const p of parcelas) {
      const pacId = lancMap[p.lancamento_id]
      if (!pacId) continue
      if (!saldoPorPac[pacId]) saldoPorPac[pacId] = { saldo: 0, temVencido: false }
      saldoPorPac[pacId].saldo += p.valor - (p.valor_pago ?? 0)
      if (p.status === 'vencido') saldoPorPac[pacId].temVencido = true
    }

    // 4. Saldo de orçamentos aprovados sem parcela
    const saldosOrc = await buscarSaldosOrcamentosAprovados(clinicaId)
    for (const s of saldosOrc) {
      if (!saldoPorPac[s.paciente_id]) saldoPorPac[s.paciente_id] = { saldo: 0, temVencido: false }
      saldoPorPac[s.paciente_id].saldo += s.saldo
    }

    // 5. Dados dos pacientes
    const pacIds = [...new Set([
      ...Object.keys(saldoPorPac),
      ...saldosOrc.map(s => s.paciente_id),
    ])]

    const listaPendentes: PacientePendente[] = []
    if (pacIds.length > 0) {
      const { data: pacsRaw } = await supabase
        .from('pacientes')
        .select('id, nome, telefone')
        .in('id', pacIds)
      for (const p of (pacsRaw ?? []) as { id: string; nome: string; telefone: string | null }[]) {
        const info = saldoPorPac[p.id]
        if (!info || info.saldo < 0.01) continue
        listaPendentes.push({
          paciente_id: p.id,
          nome:        p.nome,
          telefone:    p.telefone,
          saldo:       info.saldo,
          tem_vencido: info.temVencido,
          ultima_msg:  ultimaMsgPorPac[p.id] ?? null,
        })
      }
    }

    listaPendentes.sort((a, b) => {
      if (a.tem_vencido && !b.tem_vencido) return -1
      if (!a.tem_vencido && b.tem_vencido) return 1
      return b.saldo - a.saldo
    })

    setPendentes(listaPendentes)

    // Histórico (últimas 50 mensagens)
    const { data: histRaw } = await supabase
      .from('mensagens_whatsapp')
      .select('id, paciente_nome, telefone, mensagem, status, erro_msg, enviada_por, created_at')
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })
      .limit(50)

    setHistorico((histRaw ?? []) as MensagemHistorico[])
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])

  return { pendentes, historico, config, nomeClinica, carregando, recarregar: carregar }
}

// ─── Modal de envio ───────────────────────────────────────────────────────────

function ModalEnvio({
  paciente,
  nomeClinica,
  config,
  clinicaId,
  usuarioNome,
  onClose,
  onEnviado,
}: {
  paciente:    PacientePendente
  nomeClinica: string
  config:      ConfigWhatsApp
  clinicaId:   string
  usuarioNome: string
  onClose:     () => void
  onEnviado:   () => void
}) {
  const [template, setTemplate] = useState<'cobranca' | 'lembrete'>('cobranca')
  const [texto, setTexto] = useState(() =>
    templateCobranca({ nomePaciente: paciente.nome, saldo: paciente.saldo, nomeClinica })
  )
  const [enviando, setEnviando] = useState(false)
  const [erro,     setErro]     = useState('')

  function mudarTemplate(t: 'cobranca' | 'lembrete') {
    setTemplate(t)
    setTexto(
      t === 'cobranca'
        ? templateCobranca({ nomePaciente: paciente.nome, saldo: paciente.saldo, nomeClinica })
        : templateLembrete({ nomePaciente: paciente.nome, nomeClinica })
    )
  }

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true); setErro('')

    // Enviar via API route (server-side para não expor apikey ao Evolution API diretamente)
    const resultado = await enviarMensagemWhatsApp(config, paciente.telefone!, texto)

    // Registrar no histórico direto do cliente (supabase-browser tem sessão ativa)
    await supabase.from('mensagens_whatsapp').insert({
      clinica_id:    clinicaId,
      paciente_id:   paciente.paciente_id,
      paciente_nome: paciente.nome,
      telefone:      paciente.telefone!,
      mensagem:      texto,
      status:        resultado.ok ? 'enviada' : 'erro',
      erro_msg:      resultado.ok ? null : (resultado.erro ?? null),
      enviada_por:   usuarioNome,
    })

    setEnviando(false)
    if (resultado.ok) {
      onEnviado()
    } else {
      setErro(resultado.erro ?? 'Erro ao enviar. Verifique a configuração do WhatsApp.')
    }
  }

  const numeroFormatado = paciente.telefone
    ? formatarNumeroWhatsApp(paciente.telefone)
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div className="mt-auto bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-4 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pt-2">
            <div>
              <p className="font-bold text-gray-900">{paciente.nome}</p>
              <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                <Phone className="h-3.5 w-3.5" />
                {paciente.telefone ?? 'Sem telefone'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Saldo</p>
              <p className={`text-lg font-bold ${paciente.tem_vencido ? 'text-red-600' : 'text-amber-600'}`}>
                {formatarMoeda(paciente.saldo)}
              </p>
            </div>
          </div>

          {/* Seletor de template */}
          <div className="grid grid-cols-2 gap-2">
            {(['cobranca', 'lembrete'] as const).map(t => (
              <button
                key={t}
                onClick={() => mudarTemplate(t)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  template === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {t === 'cobranca' ? '💬 Cobrança' : '🔔 Lembrete'}
              </button>
            ))}
          </div>

          {/* Texto editável */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Mensagem (editável)
            </label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none leading-relaxed"
            />
            {numeroFormatado && (
              <p className="text-xs text-gray-400">
                Será enviado para: <span className="font-mono">{numeroFormatado}</span>
              </p>
            )}
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 px-3 py-2.5">
              <p className="text-sm text-red-700 font-medium">Falha ao enviar</p>
              <p className="text-xs text-red-500 mt-0.5">{erro}</p>
            </div>
          )}

          {/* Botões */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="py-3.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={enviar}
              disabled={enviando || !paciente.telefone || !texto.trim()}
              className="py-3.5 rounded-2xl bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:bg-green-700 disabled:opacity-40"
            >
              {enviando ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CentralMensagensPage() {
  const router = useRouter()
  const clinicaId   = useAuthStore(s => s.clinicaId)
  const usuarioNome = useAuthStore(s => s.usuario?.nome) ?? 'Usuário'

  const { pendentes, historico, config, nomeClinica, carregando, recarregar } =
    useCentralMensagens(clinicaId ?? '')

  const [aba,             setAba]             = useState<Aba>('pendentes')
  const [pacienteSelecionado, setPacienteSelecionado] = useState<PacientePendente | null>(null)
  const [sucessoNome,     setSucessoNome]     = useState('')

  function handleEnviado() {
    setSucessoNome(pacienteSelecionado?.nome ?? '')
    setPacienteSelecionado(null)
    recarregar()
    setTimeout(() => setSucessoNome(''), 3000)
  }

  const semConfig = !config

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Central de Mensagens</h1>
            <p className="text-xs text-gray-400">WhatsApp · {pendentes.length} com saldo pendente</p>
          </div>
          <button
            onClick={() => router.push('/configuracoes/whatsapp')}
            className="p-2 rounded-xl hover:bg-gray-100"
            title="Configurar WhatsApp"
          >
            <Settings className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { id: 'pendentes', label: 'Pendentes', icon: MessageCircle },
            { id: 'historico', label: 'Histórico',  icon: History },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                aba === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Aviso sem config */}
      {semConfig && (
        <div className="mx-4 mt-4 bg-amber-50 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">WhatsApp não configurado</p>
            <p className="text-xs text-amber-700 mt-0.5">Configure a Evolution API para habilitar o envio.</p>
            <button
              onClick={() => router.push('/configuracoes/whatsapp')}
              className="mt-2 text-xs font-semibold text-amber-800 underline"
            >
              Configurar agora →
            </button>
          </div>
        </div>
      )}

      {/* Toast de sucesso */}
      {sucessoNome && (
        <div className="mx-4 mt-4 bg-green-50 rounded-2xl px-4 py-3 flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">Mensagem enviada para {sucessoNome}!</p>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">

        {carregando ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))
        ) : aba === 'pendentes' ? (

          // ── Aba Pendentes ──────────────────────────────────────────────────
          pendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <p className="font-medium text-gray-500">Nenhum saldo pendente</p>
              <p className="text-sm text-gray-400 mt-1">Todos os pacientes estão em dia</p>
            </div>
          ) : (
            pendentes.map(p => {
              const jaEnviouHoje = p.ultima_msg
                ? new Date(p.ultima_msg).toDateString() === new Date().toDateString()
                : false

              return (
                <div key={p.paciente_id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-4 flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      p.tem_vencido ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{p.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.telefone ? (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{p.telefone}
                          </span>
                        ) : (
                          <span className="text-xs text-red-400">Sem telefone</span>
                        )}
                      </div>
                      {p.ultima_msg && (
                        <p className="text-xs text-gray-300 mt-0.5">
                          {jaEnviouHoje ? '✓ Mensagem enviada hoje' : `Último envio: ${formatarData(p.ultima_msg.split('T')[0])}`}
                        </p>
                      )}
                    </div>

                    {/* Saldo + botão */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className={`text-sm font-bold ${p.tem_vencido ? 'text-red-600' : 'text-amber-600'}`}>
                        {formatarMoeda(p.saldo)}
                      </p>
                      <button
                        disabled={!config || !p.telefone}
                        onClick={() => setPacienteSelecionado(p)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          jaEnviouHoje
                            ? 'bg-gray-100 text-gray-400'
                            : config && p.telefone
                              ? 'bg-green-600 text-white active:bg-green-700'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {jaEnviouHoje ? 'Enviado' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )
        ) : (

          // ── Aba Histórico ──────────────────────────────────────────────────
          historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-medium text-gray-500">Nenhuma mensagem enviada ainda</p>
            </div>
          ) : (
            historico.map(m => (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 truncate">{m.paciente_nome}</p>
                      {m.status === 'enviada' ? (
                        <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{m.telefone} · {m.enviada_por}</p>
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{m.mensagem}</p>
                    {m.erro_msg && (
                      <p className="text-xs text-red-500 mt-1">{m.erro_msg}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 flex-shrink-0 whitespace-nowrap">
                    {formatarData(m.created_at.split('T')[0])}
                  </p>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Modal de envio */}
      {pacienteSelecionado && config && (
        <ModalEnvio
          paciente={pacienteSelecionado}
          nomeClinica={nomeClinica}
          config={config}
          clinicaId={clinicaId ?? ''}
          usuarioNome={usuarioNome}
          onClose={() => setPacienteSelecionado(null)}
          onEnviado={handleEnviado}
        />
      )}
    </div>
  )
}