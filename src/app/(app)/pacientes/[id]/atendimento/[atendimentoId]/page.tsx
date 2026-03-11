// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Scan,
  Calendar, User, ClipboardList,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { formatarData } from '@/lib/utils'

interface AtendimentoFull {
  id: string
  paciente_id: string
  data_atendimento: string
  procedimento_nome: string | null
  descricao: string | null
  dentista_nome: string | null
  total_radiografias: number
}

export default function DetalheAtendimentoPage() {
  const { id: pacienteId, atendimentoId } = useParams<{ id: string; atendimentoId: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()

  const [dados, setDados] = useState<AtendimentoFull | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (!atendimentoId || !clinicaId) return
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentoId, clinicaId])

  async function carregar() {

    const { data: atend, error } = await supabase
      .from('atendimentos')
      .select('id, paciente_id, data_atendimento, descricao, procedimento_nome, procedimento_id')
      .eq('id', atendimentoId)
      .single()

    if (error || !atend) { router.back(); return }

    // Buscar nome do procedimento via tabela se só tiver o id
    let procedimentoNome = (atend.procedimento_nome as string | null) ?? null
    if (!procedimentoNome && atend.procedimento_id) {
      const { data: proc } = await supabase
        .from('procedimentos')
        .select('nome')
        .eq('id', atend.procedimento_id as string)
        .single()
      procedimentoNome = (proc as { nome: string } | null)?.nome ?? null
    }

    const { count: totalRx } = await supabase
      .from('radiografias')
      .select('*', { count: 'exact', head: true })
      .eq('atendimento_id', atendimentoId)

    setDados({
      id: atend.id as string,
      paciente_id: atend.paciente_id as string,
      data_atendimento: atend.data_atendimento as string,
      procedimento_nome: procedimentoNome,
      descricao: atend.descricao as string | null,
      dentista_nome: null,
      total_radiografias: totalRx ?? 0,
    })
    setCarregando(false)
  }

  async function excluir() {
    setExcluindo(true)
    await supabase.from('atendimentos').delete().eq('id', atendimentoId)
    router.push(`/pacientes/${pacienteId}`)
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!dados) return null

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 truncate">
          {dados.procedimento_nome ?? 'Atendimento'}
        </h1>
        <Link
          href={`/pacientes/${pacienteId}/atendimento/${atendimentoId}/editar`}
          className="p-2 rounded-full active:bg-gray-100"
        >
          <Edit2 className="h-4 w-4 text-gray-500" />
        </Link>
        <button
          onClick={() => setConfirmandoExclusao(true)}
          className="p-2 rounded-full active:bg-red-50"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">

        {/* Info clínica */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            {formatarData(dados.data_atendimento)}
          </div>
          {dados.dentista_nome && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              Dr(a). {dados.dentista_nome}
            </div>
          )}
          {dados.descricao && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{dados.descricao}</p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/pacientes/${pacienteId}/radiografias?atendimento=${atendimentoId}`}
            className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50"
          >
            <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Scan className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Raio-X</p>
              <p className="text-xs text-gray-400">
                {dados.total_radiografias} imagem{dados.total_radiografias !== 1 ? 'ns' : ''}
              </p>
            </div>
          </Link>

          <Link
            href={`/pacientes/${pacienteId}/orcamentos`}
            className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50"
          >
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Orçamento</p>
              <p className="text-xs text-gray-400">Ver / criar</p>
            </div>
          </Link>
        </div>

        {/* Aviso */}
        <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            💡 Pagamentos e cobranças são gerenciados na aba <strong>Financeiro</strong> da ficha do paciente.
          </p>
        </div>
      </div>

      {/* Modal exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Excluir atendimento?</h2>
            <p className="text-sm text-gray-500">
              O registro clínico será removido. Pagamentos e orçamentos não são afetados.
            </p>
            <button
              onClick={excluir} disabled={excluindo}
              className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {excluindo ? 'Excluindo...' : 'Sim, excluir'}
            </button>
            <button
              onClick={() => setConfirmandoExclusao(false)}
              className="w-full rounded-xl bg-gray-100 py-3.5 text-sm font-medium text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}