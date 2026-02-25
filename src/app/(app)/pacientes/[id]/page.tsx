// src/app/(app)/pacientes/[id]/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  Phone,
  Plus,
  FileText,
  Scan,
  DollarSign,
  Edit2,
  Calendar,
  CreditCard,
  ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/lib/supabase/types'
import { StatusFinanceiro, calcularStatusFinanceiro } from '@/lib/hooks/usePacienteStatus'
import { useAtendimentos } from '@/lib/hooks/useAtendimentos'
import { useRadiografias } from '@/lib/hooks/useRadiografias'
import { useAuthStore } from '@/store/auth.store'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AtendimentoItem } from '@/components/pacientes/AtendimentoItem'
import { RxGaleria } from '@/components/radiografias/RxGaleria'
import { RxUploader } from '@/components/radiografias/RxUploader'
import { FinanceiroAba } from './financeiro/FinanceiroAba'
import { iniciais, formatarTelefone, formatarData, formatarMoeda } from '@/lib/utils'

type Aba = 'resumo' | 'historico' | 'radiografias' | 'financeiro'

export default function FichaPacientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const [abaAtiva, setAbaAtiva] = useState<Aba>('resumo')
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [status, setStatus] = useState<StatusFinanceiro>('em_dia')
  const [carregandoPaciente, setCarregandoPaciente] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  const carregarPaciente = useCallback(async () => {
    if (!id || !clinicaId) {
      setCarregandoPaciente(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: pac, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !pac) {
        setErroCarregar('Paciente não encontrado')
        setTimeout(() => router.push('/pacientes'), 2000)
        return
      }

      setPaciente(pac)
      const s = await calcularStatusFinanceiro(id, clinicaId)
      setStatus(s)
    } catch (err) {
      console.error('Erro inesperado:', err)
      setErroCarregar('Erro ao carregar dados')
    } finally {
      setCarregandoPaciente(false)
    }
  }, [id, clinicaId, router])

  useEffect(() => {
    carregarPaciente()
  }, [carregarPaciente])

  const { atendimentos, carregando: carregandoAtend } = useAtendimentos(
    id ?? '',
    clinicaId ?? ''
  )

  const carregando = carregandoPaciente || carregandoAtend

  if (erroCarregar) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-red-500 mb-2">❌ {erroCarregar}</div>
        <p className="text-sm text-gray-500">Redirecionando para lista de pacientes...</p>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!paciente) return null

  const ABA_CONFIG: { key: Aba; label: string }[] = [
    { key: 'resumo',       label: 'Resumo'     },
    { key: 'historico',    label: 'Histórico'  },
    { key: 'financeiro',   label: 'Financeiro' },
    { key: 'radiografias', label: 'Raio-X'     },
  ]

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 truncate">{paciente.nome}</h1>
          <Link href={`/pacientes/${id}/editar`} className="p-2 rounded-full hover:bg-gray-100">
            <Edit2 className="h-4 w-4 text-gray-500" />
          </Link>
        </div>

        {/* Perfil */}
        <div className="px-4 py-5">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              {paciente.foto_url ? (
                <Image
                  src={paciente.foto_url}
                  alt={paciente.nome}
                  fill
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                  {iniciais(paciente.nome)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={status} />
              </div>
              {paciente.telefone && (
                <a
                  href={`tel:${paciente.telefone}`}
                  className="flex items-center gap-1 text-sm text-gray-600 mt-1"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {formatarTelefone(paciente.telefone)}
                </a>
              )}
              {paciente.data_nascimento && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatarData(paciente.data_nascimento)}
                </p>
              )}
              {paciente.cpf && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  {paciente.cpf}
                </p>
              )}
            </div>
          </div>

          {paciente.observacoes && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-800">
              {paciente.observacoes}
            </div>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="grid grid-cols-4 gap-2 px-4 pb-4">
          <button
            onClick={() => router.push(`/pacientes/${id}/atendimento/novo`)}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-600 py-3 px-2 text-white active:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">Atendimento</span>
          </button>
          <Link
            href={`/pacientes/${id}/radiografias`}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-100 py-3 px-2 text-gray-700 active:bg-gray-200 transition-colors"
          >
            <Scan className="h-5 w-5" />
            <span className="text-xs font-medium">Raio-X</span>
          </Link>
          <Link
            href={`/financeiro/lancamento?paciente=${id}`}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-100 py-3 px-2 text-gray-700 active:bg-gray-200 transition-colors"
          >
            <DollarSign className="h-5 w-5" />
            <span className="text-xs font-medium">Cobrança</span>
          </Link>
          <Link
            href={`/pacientes/${id}/orcamentos`}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-100 py-3 px-2 text-gray-700 active:bg-gray-200 transition-colors"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-medium">Orçamento</span>
          </Link>
        </div>

        {/* Abas — 4 abas com scroll horizontal se necessário */}
        <div className="flex border-t border-gray-100 overflow-x-auto scrollbar-hide">
          {ABA_CONFIG.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAbaAtiva(key)}
              className={`flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
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

      {/* Conteúdo da aba */}
      <div className="flex-1 px-4 py-4">
        {abaAtiva === 'resumo' && (
          <ResumoAba pacienteId={id} atendimentos={atendimentos} />
        )}
        {abaAtiva === 'historico' && (
          <HistoricoAba atendimentos={atendimentos} pacienteId={id} />
        )}
        {abaAtiva === 'financeiro' && clinicaId && (
          <FinanceiroAba pacienteId={id} clinicaId={clinicaId} />
        )}
        {abaAtiva === 'radiografias' && (
          <RadiografiasAba pacienteId={id} />
        )}
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ResumoAba({
  pacienteId,
  atendimentos,
}: {
  pacienteId: string
  atendimentos: ReturnType<typeof import('@/lib/hooks/useAtendimentos').useAtendimentos>['atendimentos']
}) {
  const ultimo = atendimentos[0]
  return (
    <div className="space-y-4">
      {ultimo ? (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Último atendimento
          </p>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {ultimo.procedimento_nome ?? ultimo.descricao ?? '—'}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatarData(ultimo.data_atendimento)}
              </p>
            </div>
            {ultimo.valor_total != null && (
              <span className="text-sm font-semibold text-gray-700">
                {formatarMoeda(ultimo.valor_total)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 shadow-sm text-center text-sm text-gray-400">
          Nenhum atendimento registrado
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{atendimentos.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Atendimentos</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-lg font-bold text-gray-900">
            {formatarMoeda(
              atendimentos.reduce((acc, a) => acc + (a.valor_total ?? 0), 0)
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Total gerado</p>
        </div>
      </div>
    </div>
  )
}

function HistoricoAba({
  atendimentos,
  pacienteId,
}: {
  atendimentos: ReturnType<typeof import('@/lib/hooks/useAtendimentos').useAtendimentos>['atendimentos']
  pacienteId: string
}) {
  if (atendimentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Nenhum atendimento registrado</p>
        <Link
          href={`/pacientes/${pacienteId}/atendimento/novo`}
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

function RadiografiasAba({ pacienteId }: { pacienteId: string }) {
  const { clinicaId } = useAuthStore()
  const { radiografias, carregando, deletarRadiografia, atualizarAnotacao, uploadRadiografia } =
    useRadiografias(pacienteId, clinicaId ?? '')
  const [mostrarUploader, setMostrarUploader] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {radiografias.length} imagem{radiografias.length !== 1 ? 'ns' : ''}
        </p>
        <div className="flex items-center gap-2">
          {radiografias.length > 0 && (
            <Link
              href={`/pacientes/${pacienteId}/radiografias`}
              className="text-xs text-blue-600 font-medium"
            >
              Ver todas →
            </Link>
          )}
          <button
            onClick={() => setMostrarUploader(true)}
            className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      <RxGaleria
        radiografias={radiografias}
        carregando={carregando}
        onAdicionarClick={() => setMostrarUploader(true)}
        onDeletar={deletarRadiografia}
        onAtualizarAnotacao={atualizarAnotacao}
      />

      {mostrarUploader && (
        <RxUploader
          onFechar={() => setMostrarUploader(false)}
          onUpload={uploadRadiografia}
        />
      )}
    </>
  )
}