// src/app/(app)/pacientes/[id]/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Plus, FileText,
  Edit2, ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/lib/supabase/types'
import { StatusFinanceiro, calcularStatusFinanceiro } from '@/lib/hooks/usePacienteStatus'
import { useAtendimentos } from '@/lib/hooks/useAtendimentos'
import { useAuthStore } from '@/store/auth.store'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AtendimentoItem } from '@/components/pacientes/AtendimentoItem'
import { FinanceiroAba } from './financeiro/FinanceiroAba'
import { RadiografiasAba } from './radiografias/RadiografiasAba'
import { iniciais, formatarTelefone, formatarMoeda } from '@/lib/utils'

type Aba = 'historico' | 'financeiro' | 'radiografias'

const ABA_CONFIG: { key: Aba; label: string }[] = [
  { key: 'historico',    label: 'Histórico'  },
  { key: 'financeiro',   label: 'Financeiro' },
  { key: 'radiografias', label: 'Raio-X'     },
]

export default function FichaPacientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()

  const [abaAtiva, setAbaAtiva] = useState<Aba>('historico')
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [status, setStatus] = useState<StatusFinanceiro>('em_dia')
  const [carregandoPaciente, setCarregandoPaciente] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  // Lazy: só monta a aba quando aberta pela primeira vez
  const [abasAbertas, setAbasAbertas] = useState<Set<Aba>>(new Set(['historico']))

  function irParaAba(aba: Aba) {
    setAbaAtiva(aba)
    setAbasAbertas((prev) => new Set([...prev, aba]))
  }

  const carregarPaciente = useCallback(async () => {
    if (!id || !clinicaId) { setCarregandoPaciente(false); return }
    try {
      const supabase = createClient()
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

  const { atendimentos, carregando: carregandoAtend } = useAtendimentos(id ?? '', clinicaId ?? '')

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

  const totalGerado = atendimentos.reduce((acc, a) => acc + (a.valor_total ?? 0), 0)

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
              <a href={`tel:${paciente.telefone}`}
                className="flex items-center gap-1 text-sm text-gray-600 mt-1.5"
              >
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {formatarTelefone(paciente.telefone)}
              </a>
            )}
          </div>

          {/* Métricas rápidas no canto direito */}
          <div className="flex-shrink-0 text-right border-l border-gray-100 pl-4">
            <p className="text-xl font-bold text-gray-900 leading-none">{atendimentos.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">consultas</p>
            {totalGerado > 0 && (
              <>
                <p className="text-sm font-bold text-blue-600 mt-2 leading-none">{formatarMoeda(totalGerado)}</p>
                <p className="text-xs text-gray-400 mt-0.5">gerado</p>
              </>
            )}
          </div>
        </div>

        {/* Observações */}
        {paciente.observacoes && (
          <div className="mx-4 mb-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-800">
            {paciente.observacoes}
          </div>
        )}

        {/* Ações rápidas — só as 2 principais */}
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

      {/* Conteúdo — lazy rendering com hidden para manter estado */}
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
    </div>
  )
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────

function HistoricoAba({
  atendimentos,
  pacienteId,
}: {
  atendimentos: ReturnType<typeof import('@/lib/hooks/useAtendimentos').useAtendimentos>['atendimentos']
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
          valor={a.valor_total}
          statusPagamento={a.status_pagamento}
          totalRadiografias={a.total_radiografias}
        />
      ))}
    </div>
  )
}