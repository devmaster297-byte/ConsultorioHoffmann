// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2, Trash2, Scan, Calendar, User } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
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
  const [dados, setDados] = useState<AtendimentoFull | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (!atendimentoId) return
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentoId])

  async function carregar() {
    const { data: atend } = await supabase
      .from('atendimentos')
      .select(`
        id,
        paciente_id,
        data_atendimento,
        descricao,
        procedimento:procedimentos(nome),
        dentista:usuarios(nome)
      `)
      .eq('id', atendimentoId)
      .single()

    if (!atend) {
      router.back()
      return
    }

    const { count: totalRx } = await supabase
      .from('radiografias')
      .select('*', { count: 'exact', head: true })
      .eq('atendimento_id', atendimentoId)

    setDados({
      id: atend.id,
      paciente_id: atend.paciente_id,
      data_atendimento: atend.data_atendimento,
      procedimento_nome: (atend.procedimento as unknown as { nome: string } | null)?.nome ?? null,
      descricao: atend.descricao,
      dentista_nome: (atend.dentista as unknown as { nome: string } | null)?.nome ?? null,
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
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 truncate">
          {dados.procedimento_nome ?? 'Atendimento'}
        </h1>
        <Link
          href={`/pacientes/${pacienteId}/atendimento/${atendimentoId}/editar`}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <Edit2 className="h-4 w-4 text-gray-500" />
        </Link>
        <button
          onClick={() => setConfirmandoExclusao(true)}
          className="p-2 rounded-full hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Info do atendimento */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-400" />
            {formatarData(dados.data_atendimento)}
          </div>

          {dados.dentista_nome && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="h-4 w-4 text-gray-400" />
              Dr(a). {dados.dentista_nome}
            </div>
          )}

          {dados.descricao && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {dados.descricao}
              </p>
            </div>
          )}
        </div>

        {/* Raio-X */}
        <Link
          href={`/pacientes/${pacienteId}/radiografias?atendimento=${atendimentoId}`}
          className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm active:bg-gray-50"
        >
          <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Scan className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Radiografias</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {dados.total_radiografias > 0
                ? `${dados.total_radiografias} imagem${dados.total_radiografias !== 1 ? 'ns' : ''} vinculada${dados.total_radiografias !== 1 ? 's' : ''}`
                : 'Nenhuma imagem — toque para adicionar'}
            </p>
          </div>
          <span className="text-xs text-indigo-600 font-medium">
            {dados.total_radiografias > 0 ? 'Ver' : 'Adicionar'}
          </span>
        </Link>
      </div>

      {/* Modal confirmação exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Excluir atendimento?</h2>
            <p className="text-sm text-gray-500">
              Esta ação não pode ser desfeita.
            </p>
            <button
              onClick={excluir}
              disabled={excluindo}
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
