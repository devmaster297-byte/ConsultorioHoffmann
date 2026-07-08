// src/app/(app)/pacientes/[id]/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Plus, FileText,
  Edit2, ClipboardList, MessageCircle, Send, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { Paciente } from '@/lib/supabase/types'
import { StatusFinanceiro, calcularStatusFinanceiro } from '@/lib/hooks/usePacienteStatus'
import { useAtendimentos } from '@/lib/hooks/useAtendimentos'
import { useAuthStore } from '@/store/auth.store'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AtendimentoItem } from '@/components/pacientes/AtendimentoItem'
import { FinanceiroAba } from './financeiro/FinanceiroAba'
import { RadiografiasAba } from './radiografias/RadiografiasAba'
import { iniciais, formatarTelefone, formatarMoeda } from '@/lib/utils'
import { useResumoFinanceiroPaciente } from '@/lib/hooks/useResumoFinanceiroPaciente'
import { enviarMensagemWhatsApp, templateCobranca, templateLembrete, ConfigWhatsApp } from '@/lib/whatsapp'

type Aba = 'historico' | 'financeiro' | 'radiografias'

const ABA_CONFIG: { key: Aba; label: string }[] = [
  { key: 'historico',    label: 'Histórico'  },
  { key: 'financeiro',   label: 'Financeiro' },
  { key: 'radiografias', label: 'Raio-X'     },
]

export default function FichaPacientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId, usuario } = useAuthStore()

  const [abaAtiva, setAbaAtiva] = useState<Aba>('historico')
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [status, setStatus] = useState<StatusFinanceiro>('em_dia')
  const [carregandoPaciente, setCarregandoPaciente] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  // Modal WhatsApp
  const [modalWpp, setModalWpp]       = useState(false)
  const [wppTexto, setWppTexto]       = useState('')
  const [wppEnviando, setWppEnviando] = useState(false)
  const [wppErro, setWppErro]         = useState('')
  const [wppSucesso, setWppSucesso]   = useState(false)
  const [wppConfig, setWppConfig]     = useState<ConfigWhatsApp | null>(null)

  // Lazy: só monta a aba quando aberta pela primeira vez
  const [abasAbertas, setAbasAbertas] = useState<Set<Aba>>(new Set(['historico']))

  function irParaAba(aba: Aba) {
    setAbaAtiva(aba)
    setAbasAbertas((prev) => new Set([...prev, aba]))
  }

  const carregarPaciente = useCallback(async () => {
    if (!id || !clinicaId) { setCarregandoPaciente(false); return }
    try {
      const { data: pac, error } = await supabase
        .from('pacientes').select('*').eq('id', id).single()
      if (error || !pac) {
        setErroCarregar('Paciente não encontrado')
        setTimeout(() => router.push('/pacientes'), 2000)
        return
      }
      setPaciente(pac)
      const s = await calcularStatusFinanceiro(id, clinicaId)
      setStatus(s)
    } catch {
      setErroCarregar('Erro ao carregar dados')
    } finally {
      setCarregandoPaciente(false)
    }
  }, [id, clinicaId, router])

  useEffect(() => { carregarPaciente() }, [carregarPaciente])

  // Buscar config do WhatsApp em paralelo (para o botão de mensagem)
  useEffect(() => {
    if (!clinicaId) return
    supabase
      .from('clinicas')
      .select('evolution_url, evolution_instance, evolution_apikey')
      .eq('id', clinicaId)
      .single()
      .then(({ data }) => {
        if (data?.evolution_url && data?.evolution_instance && data?.evolution_apikey) {
          setWppConfig({
            url:      data.evolution_url,
            instance: data.evolution_instance,
            apikey:   data.evolution_apikey,
          })
        }
      })
  }, [clinicaId])

  function abrirModalWpp() {
    if (!paciente) return
    const saldo = resumoFin.saldoDevedor ?? 0
    setWppTexto(
      saldo > 0
        ? templateCobranca({ nomePaciente: paciente.nome, saldo })
        : templateLembrete({ nomePaciente: paciente.nome })
    )
    setWppErro('')
    setWppSucesso(false)
    setModalWpp(true)
  }

  async function enviarWpp() {
    if (!paciente?.telefone || !wppTexto.trim() || !wppConfig) return
    setWppEnviando(true); setWppErro('')

    const resultado = await enviarMensagemWhatsApp(wppConfig, paciente.telefone, wppTexto)

    await supabase.from('mensagens_whatsapp').insert({
      clinica_id:    clinicaId,
      paciente_id:   paciente.id,
      paciente_nome: paciente.nome,
      telefone:      paciente.telefone,
      mensagem:      wppTexto,
      status:        resultado.ok ? 'enviada' : 'erro',
      erro_msg:      resultado.ok ? null : (resultado.erro ?? null),
      enviada_por:   usuario?.nome ?? 'Usuário',
    })

    setWppEnviando(false)
    if (resultado.ok) {
      setWppSucesso(true)
      setTimeout(() => setModalWpp(false), 1800)
    } else {
      setWppErro(resultado.erro ?? 'Erro ao enviar mensagem.')
    }
  }

  const { atendimentos, carregando: carregandoAtend } = useAtendimentos(id ?? '', clinicaId ?? '')
  const resumoFin = useResumoFinanceiroPaciente(id ?? '', clinicaId ?? '')

  if (erroCarregar) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-red-500 mb-2">❌ {erroCarregar}</p>
        <p className="text-sm text-gray-500">Redirecionando...</p>
      </div>
    )
  }

  if (carregandoPaciente || carregandoAtend) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!paciente) return null

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="bg-white">

        {/* Topo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 truncate">{paciente.nome}</h1>
          <Link href={`/pacientes/${id}/editar`} className="p-2 rounded-full active:bg-gray-100">
            <Edit2 className="h-4 w-4 text-gray-500" />
          </Link>
        </div>

        {/* Perfil compacto */}
        <div className="px-4 py-4 flex items-center gap-4">
          {/* Avatar */}
          <div className="relative h-14 w-14 flex-shrink-0">
            {paciente.foto_url ? (
              <Image src={paciente.foto_url} alt={paciente.nome} fill
                className="rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-base">
                {iniciais(paciente.nome)}
              </div>
            )}
          </div>

          {/* Status + telefone */}
          <div className="flex-1 min-w-0">
            <StatusBadge status={status} />
            {paciente.telefone && (
              <div className="flex items-center gap-2 mt-1.5">
                <a href={`tel:${paciente.telefone}`}
                  className="flex items-center gap-1 text-sm text-gray-600"
                >
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  {formatarTelefone(paciente.telefone)}
                </a>
                {wppConfig && (
                  <button
                    onClick={abrirModalWpp}
                    className="flex items-center gap-1 rounded-lg bg-green-500 px-2 py-0.5 text-white active:bg-green-600"
                    title="Enviar mensagem WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">WPP</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Resumo financeiro compacto */}
          <div className="flex-shrink-0 border-l border-gray-100 pl-4 space-y-1.5 text-right">
            <div>
              <p className="text-lg font-bold text-gray-900 leading-none">{atendimentos.length}</p>
              <p className="text-[10px] text-gray-400">consultas</p>
            </div>
            {!resumoFin.carregando && resumoFin.totalContratado > 0 && (
              <div>
                <p className={`text-sm font-bold leading-none ${resumoFin.saldoDevedor > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {resumoFin.saldoDevedor > 0 ? formatarMoeda(resumoFin.saldoDevedor) : '✓ Quitado'}
                </p>
                <p className="text-[10px] text-gray-400">{resumoFin.saldoDevedor > 0 ? 'em aberto' : ''}</p>
              </div>
            )}
          </div>
        </div>

        {/* Alergias */}
        {paciente.alergias && (
          <div className="mx-4 mb-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-800">
            <span className="font-semibold">⚠️ Alergias: </span>{paciente.alergias}
          </div>
        )}

        {/* Observações */}
        {paciente.observacoes && (
          <div className="mx-4 mb-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-800">
            {paciente.observacoes}
          </div>
        )}

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <button
            onClick={() => router.push(`/pacientes/${id}/atendimento/novo`)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white active:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-semibold">Novo Atendimento</span>
          </button>
          <Link
            href={`/pacientes/${id}/orcamentos`}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-gray-700 active:bg-gray-200 transition-colors"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-sm font-medium">Orçamento</span>
          </Link>
        </div>

        {/* Abas */}
        <div className="flex border-t border-gray-100">
          {ABA_CONFIG.map(({ key, label }) => (
            <button key={key} onClick={() => irParaAba(key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                abaAtiva === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 px-4 py-4">
        <div className={abaAtiva === 'historico' ? 'block' : 'hidden'}>
          {abasAbertas.has('historico') && (
            <HistoricoAba atendimentos={atendimentos} pacienteId={id} />
          )}
        </div>

        <div className={abaAtiva === 'financeiro' ? 'block' : 'hidden'}>
          {abasAbertas.has('financeiro') && clinicaId && (
            <FinanceiroAba pacienteId={id} clinicaId={clinicaId} />
          )}
        </div>

        <div className={abaAtiva === 'radiografias' ? 'block' : 'hidden'}>
          {abasAbertas.has('radiografias') && (
            <RadiografiasAba pacienteId={id} />
          )}
        </div>
      </div>

      {/* Modal WhatsApp */}
      {modalWpp && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={() => setModalWpp(false)}>
          <div className="mt-auto bg-white rounded-t-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-4 pb-8 pt-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{paciente?.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{paciente?.telefone}</p>
                </div>
                <button onClick={() => setModalWpp(false)} className="p-2 rounded-xl text-gray-400 active:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Mensagem (editável)
                </label>
                <textarea
                  value={wppTexto}
                  onChange={e => setWppTexto(e.target.value)}
                  rows={7}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none leading-relaxed"
                />
              </div>
              {wppErro && (
                <div className="rounded-xl bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">{wppErro}</p>
                </div>
              )}
              {wppSucesso ? (
                <div className="rounded-xl bg-green-50 px-3 py-2.5 text-center">
                  <p className="text-sm text-green-700 font-semibold">✓ Mensagem enviada!</p>
                </div>
              ) : (
                <button
                  onClick={enviarWpp}
                  disabled={wppEnviando || !wppTexto.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-white text-sm font-semibold active:bg-green-700 disabled:opacity-40"
                >
                  {wppEnviando
                    ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                  {wppEnviando ? 'Enviando...' : 'Enviar via WhatsApp'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba Histórico ─────────────────────────────────────────────────────────────

import type { AtendimentoDetalhado } from '@/lib/hooks/useAtendimentos'

function HistoricoAba({
  atendimentos,
  pacienteId,
}: {
  atendimentos: AtendimentoDetalhado[]
  pacienteId: string
}) {
  if (atendimentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-gray-200 mb-3" />
        <p className="text-sm text-gray-400">Nenhum atendimento registrado</p>
        <Link href={`/pacientes/${pacienteId}/atendimento/novo`}
          className="mt-3 text-sm text-blue-600 font-medium"
        >
          Registrar primeiro atendimento →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {atendimentos.map((a) => (
        <AtendimentoItem
          key={a.id}
          id={a.id}
          pacienteId={pacienteId}
          data={a.data_atendimento}
          procedimento={a.procedimento_nome}
          descricao={a.descricao}
          dentistaNome={a.dentista_nome}
          totalRadiografias={a.total_radiografias}
        />
      ))}
    </div>
  )
}